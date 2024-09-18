import fs        from "fs";
import puppeteer from "puppeteer-core";
import readline  from "readline";


function input_stdin(prompt) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

        rl.question(prompt, (answer) => {
            rl.close;
            resolve(answer);
        });
    });
}


// http://127.0.0.1:9222/json/version
const wsChromeEndpointurl = await input_stdin("Paste wsChromeEndpointurl from chrome here: ");


// init
const browser = await puppeteer.connect({ browserWSEndpoint: wsChromeEndpointurl });
const page    = await browser.newPage();
await page.setViewport({ width: 1366, height: 768 });
await page.goto("https://admin.shopify.com/store/mars-ghc-usa/apps/aftersell/analytics");


// define selectors
const AfterSell_iframe_selector = "[title='AfterSell']";
const Funnels_button_selector   = "#funnels";
const Funnels_dropdown_selector = "[class='Polaris-Select__Input']";


// resolve AfterSell iframe
const AfterSell_iframe_handle   = await page.waitForSelector(AfterSell_iframe_selector);
const AfterSell_iframe          = await AfterSell_iframe_handle.contentFrame();


// go to Funnels tab
await AfterSell_iframe.waitForSelector(Funnels_button_selector);
await AfterSell_iframe.click(Funnels_button_selector);


// get all funnel names from dropdown
await AfterSell_iframe.waitForSelector(Funnels_dropdown_selector);
await new Promise(r => setTimeout(r, 2000));
const funnel_names = await AfterSell_iframe.$$eval(`${Funnels_dropdown_selector} option`, options => options.map(option => option.textContent));
const nfunnels     = funnel_names.length - 1; 


// create output.csv
const csv_fs     = fs.createWriteStream("output.csv");
const csv_schema = "date,funnel_name,revenue_usd,impr_up1,impr_up2,acc_offers\n";
csv_fs.write(csv_schema);


// go through the dropdown
await AfterSell_iframe.focus(Funnels_dropdown_selector);
await page.keyboard.press('ArrowDown');  // make API call for first result

var curr_funnel_idx = 0;

page.on('response', async (res) => {
    const req = res.request();
    if(req.url().startsWith("https://start.aftersell.app/api/v2/analytics?")) {
        var curr_res = undefined;
        curr_res     = await res.text();  // record response
        curr_res     = JSON.parse(curr_res);

        // parse the response
        ++curr_funnel_idx;
        const yesterday_idx   = 28;
        let   date            = curr_res.dates.active[yesterday_idx];
        let   funnel_name     = funnel_names[curr_funnel_idx];
        let   revenue         = curr_res.seriesByOffer.revenue.active.upsell_1[yesterday_idx] + curr_res.seriesByOffer.revenue.active.upsell_2[yesterday_idx];
        let   impressions_up1 = curr_res.seriesByOffer.impressions.active.upsell_1[yesterday_idx];
        let   impressions_up2 = curr_res.seriesByOffer.impressions.active.upsell_2[yesterday_idx];
        let   acc_offers      = curr_res.seriesByOffer.acceptedOffers.active.upsell_1[yesterday_idx] + curr_res.seriesByOffer.acceptedOffers.active.upsell_2[yesterday_idx];
        
        const csv_row         = `${date},${funnel_name},${revenue},${impressions_up1},${impressions_up2},${acc_offers}\n`;

        // save to csv
        csv_fs.write(csv_row);
        console.log(`on funnel: ${curr_funnel_idx}/${nfunnels} -- ${funnel_name}`);


        // next
        if(curr_funnel_idx < nfunnels) {
            await page.keyboard.press('ArrowDown');  // make API call for next
        } else {
            console.log(`Done -- output: ./${csv_fs.path}`)
            process.exit(0);
        }
    }
});

