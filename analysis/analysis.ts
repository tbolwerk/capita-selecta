let page_load_timeout = 0;
let DNS_error = 0;
let consent_click_error = 0;

let page_load_time: Array<number> = [];
let requests: Array<Object> = [];
let responses: Array<Array<Object>> = [];
let requests_numberof: Array<number> = [];
//let distinct_third_parties: Array<Array<string>> = []; //TO FINISH
let distinct_third_parties: Array<Array<string>> = [["www.google.com"]]; //TO FINISH
let distinct_third_parties_numberof: Array<number> = [];
let distinct_trackers: Array<Array<string>> = [];
let distinct_trackers_numberof: Array<number> = [];
let distinct_companies: Array<Array<string>> = [];
let distinct_companies_numberof: Array<number> = []

let cookies: Array<Array<Object>> = [];


let trackerJSON;
let companyJSON;

export function findCompanies(domains: Array<string>) {
    let companies: Array<string> = [];
    for (let i in domains) {
        if (domains[i]) {
            let domain = domains[i].startsWith("www.") ? domains[i].substring(4) : domains[i];
            for (let item in companyJSON) {
                if (item == domain) {
                    companies.push(companyJSON[item].entityName);
                }
            }
        }
    }
    return [...new Set(companies)];
}

export function getMostPrevalentThirdParties() {
    let topTen = getTopTenFromList(distinct_third_parties.flat());

    let data: Array<Object> = [];
    for (let i in topTen) {
        let obj = {
            domain: i,
            occurence: topTen[i],
            isTracker: distinct_trackers.flat().includes(i)
        }
        data.push(obj);
    }
    return data
}

export function getMostPrevalentTrackers() {
    let topTen = getTopTenFromList(distinct_companies.flat());

    let data: Array<Object> = [];
    for (let i in topTen) {
        let obj = {
            entity: i,
            occurence: topTen[i],
        }
        data.push(obj);
    }
    return data
}


export function getTopTenFromList(list) {
    let topTen = list.reduce(function (acc, curr) {
        return acc[curr] ? ++acc[curr] : acc[curr] = 1, acc
    }, {});

    topTen = Object.fromEntries(
        Object.entries(topTen).sort(([, a], [, b]) => b - a)
    );

    delete topTen.undefined;
    return Object.fromEntries(Object.entries(topTen).slice(0, 10))
}

export function getLongLifeCookies() {
    let sorted = cookies.flat().sort((a, b) => (a.expires > b.expires) ? -1 : 1);
    let topThree = Object.fromEntries(Object.entries(sorted).slice(0, 3));
    for (let i in topThree) {
        topThree[i].size = JSON.stringify(topThree[i]).length;
        topThree[i].value = topThree[i].value.slice(0, 5);
    }
    return topThree;
}

export function getMostCookieRequests() {
    let list: Array<Object> = [];
    for (let i in requests) {
        let cookies = requests[i].cookie != undefined ? requests[i].cookie.split(";").length : null;
        let hostname = requests[i][":authority"];
        let website = requests[i]["referer"];
        let first_party_request = website != undefined ? (website.includes(hostname) ? true : false) : null;

        let data = {
            "cookies": cookies,
            "hostname": hostname,
            "website": website,
            "first_party_request": first_party_request,
        }
        list.push(data);
    }

    let sorted = list.sort((a, b) => (a.cookies > b.cookies) ? -1 : 1)
    return Object.fromEntries(Object.entries(sorted).slice(0, 3))
}

export function getRedirections() {
    var filteredRedirects = new Map();

    responses.forEach(responseList => {
        // Remove duplicate redirect pairs
        let redirectsUnique = new Map();
        responseList.forEach(response => {
            let redirectPair = { source: response.url, target: response.location_domain };
            if (!redirectsUnique.has(redirectPair)) {
                redirectsUnique.set(JSON.stringify(redirectPair), redirectPair);
            }            
        });

        // Collect all data into a filtered redirect map.
        redirectsUnique.forEach((redirect, redirectStr) => {
            if (filteredRedirects.has(redirectStr)) {
                let object = filteredRedirects.get(redirectStr);
                object['distinctWebsites'] = object.get('distinctWebsites') + 1;
                filteredRedirects.set(redirectStr, object);
            } else {
                redirect['distinctWebsites'] = 1;
                filteredRedirects.set(redirectStr, redirect);
            }
        });
    });

    let result = [];
    filteredRedirects.forEach((redirect, _) => {
        result.push(redirect);
    });
    return result;
}


export function setTrackers(trackers) { trackerJSON = JSON.stringify(trackers) }
export function setCompanies(companies) { companyJSON = companies; }

export function incrementPageLoadTimeout() { page_load_timeout++ }
export function incrementDNSError() { DNS_error++ }
export function incrementConsentClickError() { consent_click_error++ }

export function addPageLoadTime(item: number) { page_load_time.push(item) }
export function addRequests(request) {
    requests_numberof.push(request.length);
    for (let i in request) {
        requests.push(request[i])
    }
}

export function addResponses(responseList) {
    let list: Array<Object> = [];
    for (let i in responseList) {
        if (responseList[i].data.location != undefined) {
            let locationDomain;
            let urlDomain;
            try {
                locationDomain = (new URL(responseList[i].data.location)).hostname;
            } catch (err) {
                locationDomain = null
            }
            try {
                urlDomain = (new URL(responseList[i].url)).hostname;
            } catch (err) {
                urlDomain = null
            }

            list.push({
                "domain": responseList[i].domain,
                "location_domain": locationDomain,
                "url": urlDomain
            })
        }
    }

    responses.push(list);
}

export function addDistinctThirdParties(items: Array<string>) {
    items = [...new Set(items)];
    distinct_third_parties.push(items);
    distinct_third_parties_numberof.push(items.length);

    let trackers = items.filter(item => trackerJSON.search(item) != -1)
    distinct_trackers.push(trackers);
    distinct_trackers_numberof.push(trackers.length);

    let companies = findCompanies(trackers);
    distinct_companies.push(companies);
    distinct_companies_numberof.push(companies.length);
}

export function addCookies(item: Array<Object>) { cookies.push(item) }

export function print(DataSet, mode: string) {
    let data = {
        mode: mode,

        page_load_timeout: page_load_timeout,
        DNS_error: DNS_error,
        consent_click_error: consent_click_error,

        requests: getMostCookieRequests(),

        page_load_time_min: Math.min(...page_load_time),
        page_load_time_max: Math.max(...page_load_time),
        page_load_time: page_load_time.reduce((p, c) => p + c, 0) / page_load_time.length,
        requests_min: Math.min(...requests_numberof),
        requests_max: Math.max(...requests_numberof),
        requests_numberof: requests_numberof.reduce((p, c) => p + c, 0) / requests_numberof.length,
        distinct_third_parties: distinct_third_parties,
        distinct_third_parties_numberof_min: Math.min(...distinct_third_parties_numberof),
        distinct_third_parties_numberof_max: Math.max(...distinct_third_parties_numberof),
        distinct_third_parties_numberof: distinct_third_parties_numberof.reduce((p, c) => p + c, 0) / distinct_third_parties_numberof.length,
        distinct_trackers: distinct_trackers,
        distinct_trackers_numberof_min: Math.min(...distinct_trackers_numberof),
        distinct_trackers_numberof_max: Math.max(...distinct_trackers_numberof),
        distinct_trackers_numberof: distinct_trackers_numberof.reduce((p, c) => p + c, 0) / distinct_trackers_numberof.length,
        distinct_companies: distinct_companies,
        distinct_companies_numberof_min: Math.min(...distinct_companies_numberof),
        distinct_companies_numberof_max: Math.max(...distinct_companies_numberof),
        distinct_companies_numberof: distinct_companies_numberof.reduce((p, c) => p + c, 0) / distinct_companies_numberof.length,

        most_prevalent_third_parties: getMostPrevalentThirdParties(),
        most_prevalent_trackers: getMostPrevalentTrackers(),

        long_life_cookies: getLongLifeCookies(),
        redirections: getRedirections(),
    }

    let jsonData = JSON.stringify(data);
    DataSet.writeToFile(jsonData, `analysis/data/data_${mode}.json`); // TODO: fix this
}


