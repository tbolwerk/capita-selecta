// For more information, see https://crawlee.dev/
import { PlaywrightCrawler, ProxyConfiguration,Dataset } from 'crawlee';
import {Page, selectors} from 'playwright';
import {Log} from '@apify/log';
const consent_accept_selectors:Map<string, string> = new Map([
    ["google", "#L2AGLb"],
    // ["onetrust-cookiepro", "#onetrust-accept-btn-handler"],
    // ["onetrust-enterprise", "#accept-recommended-btn-handler"],
    // ["cookiebot", "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll"],
    // ["cookiehub", "button.ch2-allow-all-btn"],
    // ["typo3-wacon", ".waconcookiemanagement .cookie-accept"],
    // ["cookiefirst", "[data-cookiefirst-action='accept']"],
    // ["osano", ".osano-cm-accept-all"],
    // ["orejime", ".orejime-Button--save"],
    // ["axeptio", "#axeptio_btn_acceptAll"],
    // ["civic-uk-cookie-control", "#ccc-notify-accept"],
    // ["usercentrics", "[data-testid='uc-accept-all-button']"],
    // ["cookie-yes", "[data-cky-tag='accept-button']"],
    // ["secure-privacy", ".evSpAcceptBtn"],
    // ["quantcast", "#qc-cmp2-ui button[mode='primary']"],
    // ["didomi", "#didomi-notice-agree-button"],
    // ["trustarc-truste", "#truste-consent-button"],
    // ["non-specific-custom", "#AcceptCookiesButton, #acceptCookies, .cookie-accept, #cookie-accept, .gdpr-cookie--accept-all, button[class*='accept'], button[id*='accept'], [class*='accept'], [id*='accept'], #cookiebanner button, [class*='cookie']"]
]);


const startUrls = ['https://google.nl'];
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
    maxRequestsPerCrawl: 50,
    
    // This function will be called for each URL to crawl.
    // Here you can write the Playwright scripts you are familiar with,
    // with the exception that browsers and pages are automatically managed by Crawlee.
    // The function accepts a single parameter, which is an object with a lot of properties,
    // the most important being:
    // - request: an instance of the Request class with information such as URL and HTTP method
    // - page: Playwright's Page object (see https://playwright.dev/docs/api/class-page)
    async requestHandler({ request, page, enqueueLinks, log }) {
        await CrawlAccept(page,log);
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

await crawler.addRequests(startUrls);

// Run the crawler and wait for it to finish.
await crawler.run();

console.log('Crawler finished.');

await crawler.run(startUrls);

async function CrawlAccept(page:Page, log:Log){
    await consent_accept_selectors.forEach(async selector => {
            const locators = await page.locator(selector).all();
            if(locators.length > 0){
                log.info(`consent button found for ${selector}`);
                locators.forEach(async locator => await locator.click());
            }else{
                log.info(`consent button not found for ${selector}`);
            }
    });
    return page.screenshot({path: 'after-consent.png'});
}

