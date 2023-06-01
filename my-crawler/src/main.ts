// For more information, see https://crawlee.dev/
import * as path from "path";
import { join } from "path";
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

// Import the Chromium browser into our scraper.
import { chromium, Browser, Page ,Request, selectors  } from 'playwright';
import { Command } from 'commander'
import { parse } from 'csv-parse';
import { load } from 'csv-load-sync';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

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


class PlaywrightCrawler{
    private browser!: Browser;
    private headless!:boolean;
    private requestHandler: (page: Page) => void;
    private links :string[] = [];
    constructor(headless: boolean, requestHandler: (page: Page) => void){
        this.headless = headless;
        this.requestHandler = requestHandler;
    }

    public addRequests(links: string[]){
        this.links = links;
    }
    public async run(){
        this.browser = await chromium.launch({
            headless: this.headless, logger: {
                isEnabled: (name, severity) => name === 'browser',
                log: (name, severity, message, args) => console.log(`${severity}::${name} ${message}`)
              }
        });
        
        
        this.links.forEach(async link => {
            const page = await this.browser.newPage({     
                // We have to add this flag to enable JavaScript execution
                // on GitHub. waitForFunction() would not work otherwise.
                                                    bypassCSP: true
                                                    });
            await page.goto(link);
            await this.requestHandler(page);
            // Turn off the browser to clean up after ourselves.
            await this.browser.close();
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

// async function interceptRequest(request:Request) {
//     const response = await  request.response();
//     await Dataset.pushData({request: request, response: response});
// }

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

function writePageVisitInfoToFile(info: string, domain: string) {
    let fs = require('fs');
    fs.writeFile(`../data/${domain}.json`, info, function(err){
        if (err) {
            console.error(err);
        }
    })
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
const crawler = new PlaywrightCrawler(true,
    async (page:Page) => {
        let domain = getDomain(page.url());
        // # Issue 7
        // Crawler intercepts and save HTTP request and response in Dataset.
        // Not sure if headers only is enough? await data.text() throws errors for response..?
        // page.on("response", async data => await Dataset.pushData({ response: {headers: (await data.allHeaders())}}));
        // page.on("request", async data => await Dataset.pushData({ request: (await data.allHeaders())}));
       
        // await Dataset.pushData({request: interceptRequest, response: interceptResponse});
        await page.waitForTimeout(10000);

        // Only accept cookies when the consent mode says so
        if (validatedArgs.consentMode == ConsentMode.Accept) {
            page.screenshot({ path: '../screenshots/' + domain.concat('_accept_pre_consent.png') });

            let accepted = await CrawlAccept(page, domain);
            if (!accepted) {
                console.info(`No consent dialog found for ${domain} TODO: verify if this is true.`);
            }

            await page.waitForTimeout(10000);
            await page.screenshot({ path: '../screenshots/' + domain.concat('_accept_post_consent.png') });

        }else if(validatedArgs.consentMode == ConsentMode.Noop){ // # Issue 2 crawler must not accept cookies or decline
            await page.screenshot({ path: '../screenshots/' + domain.concat('_noop.png') });
        } else { // default to noop
            await page.screenshot({ path: '../screenshots/' + domain.concat('_noop.png') });
        }


        console.info(`Processing ${page.url()}...`);
    });

crawler.addRequests(validatedArgs.targetUrls);

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
