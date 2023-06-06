import * as path from "path";
import { join } from "path";
import { readFileSync, write } from 'fs';
import { fileURLToPath } from 'url';

// import { PlaywrightCrawler} from 'crawlee';
import { PlaywrightCrawler } from "./crawler";

// Import the Chromium browser into our scraper.
import { chromium, Browser, Page, Request, selectors } from 'playwright';
import { Command } from 'commander'
import { parse } from 'csv-parse';
import { load } from 'csv-load-sync';
import { createRequire } from 'module';
import trackers from '../../analysis/data/services.json' assert {type: 'json'};
import companies from '../../analysis/data/domain_map.json' assert {type: 'json'};

const require = createRequire(import.meta.url);
const analysis = require('../../analysis/analysis');
const playwright = require('playwright');

analysis.setTrackers(trackers);
analysis.setCompanies(companies);

const dataFolder = "../crawl_data/";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

const WAIT_DURATION = 10000

const selectors = ['a', 'button', 'div', 'span', 'form', 'p', 'dialog'];
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


class PlaywrightCrawler {
    private browser!: Browser;
    private headless!: boolean;
    private requestHandler: (page: Page) => void;
    private links: string[] = [];
    constructor(headless: boolean, requestHandler: (page: Page) => void) {
        this.headless = headless;
        this.requestHandler = requestHandler;
    }

    public addRequests(links: string[]) {
        this.links = links;
    }
    public async run() {
        this.browser = await chromium.launch({
            headless: this.headless, logger: {
                isEnabled: (name, severity) => name === 'browser',
                log: (name, severity, message, args) => console.log(`${severity}::${name} ${message}`)
            }
        });

        let counter = 0;
        this.links.forEach(async link => {
            const browser = await this.browser.newContext();
            const page = await browser.newPage();

            try {
                let startLoading = new Date();
                await page.goto(link, { timeout: 10000 });
                let stopLoading = new Date();
                let loadingTime = stopLoading.getTime() - startLoading.getTime()
                analysis.addPageLoadTime(loadingTime);
                analysis.addCookies(await browser.cookies())
            } catch (error) {
                if (error instanceof playwright.errors.TimeoutError) {
                    console.error("Timeout error occured: " + error);
                    analysis.incrementPageLoadTimeout();
                }
                else {
                    console.error("DNS error occured: ", error);
                    analysis.incrementDNSError();
                }
            }
            await this.requestHandler(page);
            // Turn off the browser to clean up after ourselves.
            await this.browser.close();

            counter++;
            if (counter == this.links.length){
                        analysis.print(Dataset, validatedArgs.consentMode == ConsentMode.Accept ? "accept" : "noop");
            }

        });

    }
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

class DataSet {
    private fs = require('fs');
    private folder: string;
    constructor(folder: string) {
        this.folder = folder;
    }

    private writeToFile(data: string, filename: string) {
        this.fs.writeFile(filename, data, function (err) {
            if (err) {
                console.error(err);
            }
        })
    }
    private appendToFile(data: string, filename: string): boolean {
        this.fs.appendFile(filename, data, function (err) {
            if (err) {
                console.error(err);
                return false;
            } else {
                return true;
            }
        });
        return true;
    }
    public writePageVisitInfoToFile(info: string, domain: string, consent_mode: string) {
        this.writeToFile(info, `${this.folder}/${domain}_${consent_mode}.json`);
    }

    public pushData(data, requestURL, filename: string) {
        const now = Date.now();
        const formattedData = JSON.stringify({
            requestURL: requestURL,
            timestamp: now,
            headers: JSON.stringify(data).substring(0, 512)
        });


        if (!this.appendToFile(`${formattedData}\n`, `${this.folder}/${filename}`)) {
            this.writeToFile(formattedData, `${this.folder}/${filename}`);
        }
    }
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
const Dataset = new DataSet(dataFolder);
const validatedArgs = validateArgs(options);
console.log(validatedArgs);

// Create an instance of the PlaywrightCrawler class - a crawler
// that automatically loads the URLs in headless Chrome / Playwright.
const crawler = new PlaywrightCrawler(true,
    async (page: Page) => {
        let pageload_start_ts = Date.now();
        let requestList: Object[] = [];
        let domain = getDomain(page.url());
        // # Issue 7 TODO: Fix this, creat Dataset
        // Crawler intercepts and save HTTP request and response in Dataset.
        // Not sure if headers only is enough? await data.text() throws errors for response..?
        page.on("response", async data => analysis.addResponses(await data.allHeaders()));
        page.on("response", async data => Dataset.pushData({ response: { headers: (await data.allHeaders()) } }, page.url(), "pages.json"));
        page.on("request", async data => Dataset.pushData({ request: (await data.allHeaders()) }, page.url(), "pages.json")); //don't think this is necessary?
        page.on("request", async data => requestList.push(await data.allHeaders()));
        // await Dataset.pushData({request: interceptRequest, response: interceptResponse});
        await page.waitForTimeout(10000);

        // Only accept cookies when the consent mode says so
        if (validatedArgs.consentMode == ConsentMode.Accept) {
            page.screenshot({ path: dataFolder + domain.concat('_accept_pre_consent.png') });

            let accepted = await CrawlAccept(page, domain);
            if (!accepted) {
                console.info(`No consent dialog found for ${domain} TODO: verify if this is true.`);
                
                // Analysis                
                analysis.incrementConsentClickError();
            }

            await page.waitForTimeout(10000);
           //await page.screenshot({ path: dataFolder + domain.concat('_accept_post_consent.png') }); TODO UNCOMMENT
        } else if (validatedArgs.consentMode == ConsentMode.Noop) { // # Issue 2 crawler must not accept cookies or decline
            await page.screenshot({ path: dataFolder + domain.concat('_noop.png') });
        } else { // default to noop
            await page.screenshot({ path: dataFolder + domain.concat('_noop.png') });
        }

        // Analysis
        analysis.addRequests(requestList);
        let authorities = [];
        for (let request in requestList) {
            authorities.push(JSON.parse(JSON.stringify(requestList[request]))[":authority"]);
        };
        analysis.addDistinctThirdParties(authorities);



        let pageload_end_ts = Date.now();

        let page_visit_info = {
            website_domain: "https://" + domain,
            post_pageload_url: page.url(),
            pageload_start_ts: pageload_start_ts,
            pageload_end_ts: pageload_end_ts,
            requests: requestList
        }

        Dataset.writePageVisitInfoToFile(JSON.stringify(page_visit_info), domain, validatedArgs.consentMode == 0 ? 'accept' : 'noop');
        console.info(`Processing ${page.url()}...`);
        //analysis.print(Dataset, validatedArgs.consentMode == ConsentMode.Accept ? "accept" : "noop");
    });

await crawler.addRequests(validatedArgs.targetUrls);

// Run the crawler and wait for it to finish.
await crawler.run();

console.log('Crawler finished.');

// Sanitize the pass candidate word and check whether we recognize
// it as acceptance word.
function IsAcceptWord(word: String) {
    const sanitizedWord = word.replace('✓›!\n', '').toLowerCase();
    return acceptWords.includes(sanitizedWord);
}

function ConstructSelector(entity) {
    let selector = entity.locator('css=' + selectors[0] + ':visible');

    for (let i = 1; i < selectors.length; i++) {
        selector = selector.or(entity.locator('css=' + selectors[i] + ':visible'));
    }

    return selector;
}

// A function that will accept a consent dialogue on a page
// Element roles are based on https://github.com/marty90/priv-accept/blob/main/priv-accept.py
// accept_words.txt is based on https://github.com/marty90/priv-accept/blob/main/accept_words.txt
async function CrawlAccept(page: Page, domain: string) {
    let selector = ConstructSelector(page);
    const elems = await selector.all();

    // Check the main page
    for (const elem of elems) {
        let word = await elem.innerText();
        if (IsAcceptWord(word)) {
            console.info(`Found consent acceptance candidate '${word}' for ${domain}`);
            await elem.click();

            // Note, maybe we shouldn't return yet, but some timeouts could be given of the
            // consent accept reroutes us (so for now just stop loading the other elements).
            return true;
        }
    }

    // Check embedded IFrames
    for (const frame of page.frames()) {
        let selector = ConstructSelector(frame);
        const elems = await selector.all();

        for (const elem of elems) {
            let word = await elem.innerText();
            if (IsAcceptWord(word)) {
                console.info(`Found consent acceptance candidate '${word}' (in iFrame) for ${domain}`);
                await elem.click();

                // Note, maybe we shouldn't return yet, but some timeouts could be given of the
                // consent accept reroutes us (so for now just stop loading the other elements).
                return true;
            }
        }
    }

    return false;
}
