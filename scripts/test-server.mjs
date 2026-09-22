import { unstable_dev } from "wrangler";
const worker = await unstable_dev("dist/server/index.js", {
 config:"dist/server/wrangler.json",local:true,ip:"127.0.0.1",port:8788,inspectorPort:0,
 persist:true,persistTo:".wrangler/qa-v2",vars:{OWNER_EMAIL:"test-owner@example.com"},
 experimental:{watch:false,disableExperimentalWarning:true,disableDevRegistry:true},
});
process.on("SIGINT",async()=>{await worker.stop();process.exit(0);});
await worker.waitUntilExit();
