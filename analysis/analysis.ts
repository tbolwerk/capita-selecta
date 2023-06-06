let page_load_timeout = 0; //done
let DNS_error = 0; //done
let consent_click_error = 0; //done

let page_load_time: Array<number> = []; //done
let requests: Array<number> = []; //done
//let distinct_third_parties: Array<Array<string>> = []; //TO FINISH
let distinct_third_parties: Array<Array<string>> = [["www.google.com"]]; //TO FINISH
let distinct_third_parties_numberof: Array<number> = [];
let distinct_trackers: Array<Array<string>> = [];
let distinct_trackers_numberof: Array<number> = [];
let distinct_companies: Array<Array<string>> = [];
let distinct_companies_numberof: Array<number> = []

let trackerJSON;
let companyJSON;

function findCompanies(domains: Array<string>) {
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

function getMostPrevalentThirdParties() {
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

function getMostPrevalentTrackers() {
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


function getTopTenFromList(list){
    let topTen = list.reduce(function (acc, curr) {
        return acc[curr] ? ++acc[curr] : acc[curr] = 1, acc
    }, {});

    topTen = Object.fromEntries(
        Object.entries(topTen).sort(([, a], [, b]) => b - a)
    );

    delete topTen.undefined;
    return Object.fromEntries(Object.entries(topTen).slice(0, 10))
}

module.exports = {
    setTrackers: (trackers) => { trackerJSON = JSON.stringify(trackers) },
    setCompanies: (companies) => { companyJSON = companies; },

    incrementPageLoadTimeout: () => { page_load_timeout++ },
    incrementDNSError: () => { DNS_error++ },
    incrementConsentClickError: () => { consent_click_error++ },

    addPageLoadTime: (item: number) => { page_load_time.push(item) },
    addRequests: (item: number) => { requests.push(item) },
    addDistinctThirdParties: (items: Array<string>) => {
        items = [...new Set(items)];
        distinct_third_parties.push(items);
        distinct_third_parties_numberof.push(items.length);

        let trackers = items.filter(item => trackerJSON.search(item) != -1)
        distinct_trackers.push(trackers);
        distinct_trackers_numberof.push(trackers.length);

        let companies = findCompanies(trackers);
        distinct_companies.push(companies);
        distinct_companies_numberof.push(companies.length);

    },

    print: (DataSet, mode: string) => {
        let data = {
            mode: mode,

            page_load_timeout: page_load_timeout,
            DNS_error: DNS_error,
            consent_click_error: consent_click_error,

            page_load_time_min: Math.min(...page_load_time),
            page_load_time_max: Math.max(...page_load_time),
            page_load_time: page_load_time.reduce((p, c) => p + c, 0) / page_load_time.length,
            requests_min: Math.min(...requests),
            requests_max: Math.max(...requests),
            requests: requests.reduce((p, c) => p + c, 0) / requests.length,
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
        }

        let jsonData = JSON.stringify(data);
        DataSet.writeToFile(jsonData, `../analysis/data/data_${mode}.json`);
    }
};

