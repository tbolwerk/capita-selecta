// For more information, see https://crawlee.dev/
import * as path from "path";
import { join } from "path";
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

import { PlaywrightCrawler, ProxyConfiguration, Dataset } from 'crawlee';
import { Page, selectors } from 'playwright';
import { Log } from '@apify/log';
import { Command } from 'commander'
import { parse } from 'csv-parse';
import { load } from 'csv-load-sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

// TODO: change to 10 seconds
const WAIT_DURATION = 2000

const selectors = ['a', 'button', 'span', 'form', 'p'];
const acceptWords = readFileSync(join(__dirname, 'accept_words.txt'), 'utf-8').split(/\r?\n/);

program
    .option('--accept', 'Run the crawler in accept mode.')
    .option('--noop', 'Run the crawler in noop mode.')
    .option('-u <url>', 'Pass a single URL/domain as target.')
    .option('-i <filePath>', 'Pass a path to a .csv file containing a list of URLs/domains.');

program.parse();

enum ConsentMode {
    Accept,
    Noop,
}

interface ValidatedArgs {
    consentMode: ConsentMode;
    targetUrls: Array<string>;
}

export const sleep = async (waitTime: number) =>
    new Promise(resolve =>
        setTimeout(resolve, waitTime));

// Check whether the domain is already in URL form or needs to be prefixed with 'https://'.
function toUrl(domain: string): string {
    if (domain.startsWith('https')) {
        return domain;
    }
    else {
        return 'https://'.concat(domain);
    }
}

function getDomain(url: string): string {
    let domain = (new URL(url));
    return domain.hostname.replace('www.', '');
}

function parseRankedDomainsCsv(filePath: string): string[] {
    const csvFilePath = path.resolve(__dirname, '../'.concat(filePath));
    const domains = load(csvFilePath, {
        skip: ['tranco_rank']
    });

    return domains;
}

// Validate the command line arguments passed to the script and return a
// ValidatedArgs instance when successfull or exit the program otherwise.
function validateArgs(options): ValidatedArgs {
    if (options.accept == options.noop) {
        console.error("Either `--accept` or `--noop` must be passed as consent mode.");
        process.exit(1);
    }
    if (!options.u && !options.i) {
        console.error("Either a single target website or a file with multiple targets must be passed. Run `-h` for usage instructions.");
        process.exit(1);
    }

    var targetUrls: string[] = [];

    // Here we make a deliberate choice to allow -u and -i to be passed as argument
    // simultaenously. Doing so simply takes the conjunction of the two option values.
    if (options.u) {
        targetUrls.push(toUrl(options.u));
    }
    if (options.i) {
        const domains = parseRankedDomainsCsv(options.i);
        domains.forEach((domain) => {
            targetUrls.push(toUrl(domain['domain']));
        });
    }

    return {
        consentMode: (options.accept ? ConsentMode.Accept : ConsentMode.Noop),
        targetUrls: targetUrls
    };
}

const options = program.opts();
const validatedArgs = validateArgs(options);

console.log(validatedArgs);

// Create an instance of the PlaywrightCrawler class - a crawler
// that automatically loads the URLs in headless Chrome / Playwright.
const crawler = new PlaywrightCrawler({
    launchContext: {
        // Here you can set options that are passed to the playwright .launch() function.
        launchOptions: {
            headless: true,
        },
    },

    // Stop crawling after several pages
    maxRequestsPerCrawl: 1,

    // This function will be called for each URL to crawl.
    // Here you can write the Playwright scripts you are familiar with,
    // with the exception that browsers and pages are automatically managed by Crawlee.
    // The function accepts a single parameter, which is an object with a lot of properties,
    // the most important being:
    // - request: an instance of the Request class with information such as URL and HTTP method
    // - page: Playwright's Page object (see https://playwright.dev/docs/api/class-page)
    async requestHandler({ request, page, enqueueLinks, log }) {
        let domain = getDomain(request.url);

        await sleep(WAIT_DURATION);

        // Only accept cookies when the consent mode says so
        if (validatedArgs.consentMode == ConsentMode.Accept) {
            page.screenshot({ path: domain.concat('_accept_pre_consent.png') });
            await CrawlAccept(page, log, domain);
            await sleep(WAIT_DURATION);
            await page.screenshot({ path: domain.concat('_accept_post_consent.png') });

        } else {
            await page.screenshot({ path: domain.concat('_noop.png') });
        }
        log.info(`Processing ${request.url}...`);

        // A function to be evaluated by Playwright within the browser context.
        const data = await page.$$eval('.athing', ($posts) => {
            const scrapedData: { title: string; rank: string; href: string }[] = [];

            // We're getting the title, rank and URL of each post on Hacker News.
            $posts.forEach(($post) => {
                scrapedData.push({
                    title: $post.querySelector('.title a').innerText,
                    rank: $post.querySelector('.rank').innerText,
                    href: $post.querySelector('.title a').href,
                });
            });

            return scrapedData;
        });

        // Store the results to the default dataset.
        await Dataset.pushData(data);

        // Find a link to the next page and enqueue it if it exists.
        const infos = await enqueueLinks({
            selector: '.morelink',
        });

        if (infos.processedRequests.length === 0) log.info(`${request.url} is the last page!`);
    },

    // This function is called if the page processing failed more than maxRequestRetries+1 times.
    failedRequestHandler({ request, log }) {
        log.info(`Request ${request.url} failed too many times.`);
    },
});

await crawler.addRequests(validatedArgs.targetUrls);

// Run the crawler and wait for it to finish.
await crawler.run();

console.log('Crawler finished.');

// A function that will accept a consent dialogue on a page
// Element roles are based on https://github.com/marty90/priv-accept/blob/main/priv-accept.py
// accept_words.txt is based on https://github.com/marty90/priv-accept/blob/main/accept_words.txt
async function CrawlAccept(page: Page, log: Log, domain: string) {
    var found = false;
    let selector = page.locator('css=' + selectors[0] + ':visible');

    for (let i = 1; i < selectors.length; i++) {
        selector = selector.or(page.locator('css=' + selectors[i] + ':visible'));
    }

    let elems = await selector.all();
    await elems.forEach(async elem => {
        let text = (await elem.innerText()).replace('✓›!\n', '').toLowerCase();

        // Do we recognize this text as a typical consent dialog?
        if (acceptWords.includes(text)) {
            found = true;
            console.log("Found text '" + text + "'")
            await elem.click();
        }
    });

    if (!found) {
        console.log('No consent dialog found for ' + domain + '. TODO: verify if this is true.');
    }
}
