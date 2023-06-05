let page_load_timeout_accept = 0; //done
let page_load_timeout_noop = 0; //done
let DNS_error_accept = 0; //done
let DNS_error_noop = 0; //done
let consent_click_error_accept = 0; //done
const consent_click_error_noop = "NA"; //done

let page_load_time_accept: Array<number> = []; //done
let page_load_time_noop: Array<number> = []; //done
let requests_accept: Array<number> = []; //done
let requests_noop: Array<number> = []; //done
let distinct_third_parties_accept: Array<Array<string>> = []; //TO FINISH
let distinct_third_parties_noop: Array<Array<string>> = []; //TO FINISH
let distinct_third_parties_numberof_accept: Array<number> = [];
let distinct_third_parties_numberof_noop: Array<number> = [];
let distinct_trackers_accept = "tobeimplemented"; 
//ADD MORE TRACKERS AND ENTITIES/COMPANIES



module.exports = {
    incrementPageLoadTimeoutAccept: () => { page_load_timeout_accept++ },
    incrementPageLoadTimeoutNoop: () => { page_load_timeout_noop++ },
    incrementDNSErrorAccept: () => { DNS_error_accept++ },
    incrementDNSErrorNoop: () => { DNS_error_noop++ },
    incrementConsentClickErrorAccept: () => { consent_click_error_accept++ },

    addPageLoadTimeAccept: (item: number) => { page_load_time_accept.push(item) },
    addPageLoadTimeNoop: (item: number) => { page_load_time_accept.push(item) },
    addRequestsAccept: (item: number) => { requests_accept.push(item) },
    addRequestsNoop: (item: number) => { requests_noop.push(item) },
    addDistinctThirdPartiesAccept: (items: Array<string>) => {
        items = [...new Set(items)];
        distinct_third_parties_accept.push(items);
        distinct_third_parties_numberof_accept.push(items.length);
    },
    addDistinctThirdPartiesNoop: (items: Array<string>) => { 
        items = [...new Set(items)];
        distinct_third_parties_noop.push(items);
        distinct_third_parties_numberof_noop.push(items.length);
    },


    print: (DataSet) => {
        let data = {
            page_load_timeout_accept: page_load_timeout_accept,
            page_load_timeout_noop: page_load_timeout_noop,
            DNS_error_accept: DNS_error_accept,
            DNS_error_noop: DNS_error_noop,
            consent_click_error_accept: consent_click_error_accept,
            consent_click_error_noop: consent_click_error_noop,
            page_load_time_accept_min: Math.min(...page_load_time_accept),
            page_load_time_accept_max: Math.max(...page_load_time_accept),
            page_load_time_accept: page_load_time_accept.reduce((p, c) => p + c, 0) / page_load_time_accept.length,
            page_load_time_noop_min: Math.min(...page_load_time_noop),
            page_load_time_noop_max: Math.max(...page_load_time_noop),
            page_load_time_noop: page_load_time_noop.reduce((p, c) => p + c, 0) / page_load_time_noop.length,
            requests_accept_min: Math.min(...requests_accept),
            requests_accept_max: Math.max(...requests_accept),
            requests_accept: requests_accept.reduce((p, c) => p + c, 0) / requests_accept.length,
            requests_noop_min: Math.min(...requests_noop),
            requests_noop_max: Math.max(...requests_noop),
            requests_noop: requests_noop.reduce((p, c) => p + c, 0) / requests_noop.length,
            distinct_third_parties_acceptTODELETE: distinct_third_parties_accept,
            distinct_third_parties_numberof_accept_min: Math.min(...distinct_third_parties_numberof_accept),
            distinct_third_parties_numberof_accept_max: Math.max(...distinct_third_parties_numberof_accept),
            distinct_third_parties_numberof_accept: distinct_third_parties_numberof_accept.reduce((p, c) => p + c, 0) / distinct_third_parties_numberof_accept.length,
            distinct_third_parties_numberof_noop: distinct_third_parties_numberof_noop.reduce((p, c) => p + c, 0) / distinct_third_parties_numberof_noop.length,
            distinct_third_parties_numberof_noop_min: Math.min(...distinct_third_parties_numberof_noop),
            distinct_third_parties_numberof_noop_max: Math.max(...distinct_third_parties_numberof_noop),
        }

        let jsonData = JSON.stringify(data);
        DataSet.writeToFile(jsonData, "../analysis/data.json");
    }
};

