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





module.exports = {
    incrementPageLoadTimeoutAccept: () => { page_load_timeout_accept++ },
    incrementPageLoadTimeoutNoop: () => { page_load_timeout_noop++ },
    incrementDNSErrorAccept: () => { DNS_error_accept++ },
    incrementDNSErrorNoop: () => { DNS_error_noop++ },
    increaseConsentClickErrorAccept: () => { consent_click_error_accept++ },

    addPageLoadTimeAccept: (item: number) => { page_load_time_accept.push(item) },
    addPageLoadTimeNoop: (item: number) => { page_load_time_accept.push(item) },
    addRequestsAccept: (item: number) => {requests_accept.push(item)},
    addRequestsNoop: (item: number) => {requests_noop.push(item)},
 

    print: (DataSet) => {
        let data = {
            page_load_timeout_accept: page_load_timeout_accept,
            page_load_timeout_noop: page_load_timeout_noop,
            DNS_error_accept: DNS_error_accept,
            DNS_error_noop: DNS_error_noop,
            consent_click_error_accept: consent_click_error_accept,
            consent_click_error_noop: consent_click_error_noop,
            page_load_time_accept: page_load_time_accept.reduce((p, c) => p + c, 0) / page_load_time_accept.length,
            page_load_time_noop: page_load_time_noop.reduce((p, c) => p + c, 0) / page_load_time_noop.length,
            requests_accept: requests_accept.reduce((p, c) => p + c, 0) / requests_accept.length,
            requests_noop: requests_noop.reduce((p, c) => p + c, 0) / requests_noop.length,
        }

        let jsonData = JSON.stringify(data);
        DataSet.writeToFile(jsonData, "../analysis/data.json");
    }
};

