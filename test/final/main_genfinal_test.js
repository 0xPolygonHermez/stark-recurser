const version = require("../../package").version;
const ejs = require("ejs");
const path = require("path");
const fs = require("fs");
const argv = require("yargs")
    .version(version)
    .usage("node main_genfinal_test.js -p <publics_path.json> -t <test_final.js>")
    .alias("p", "publics")
    .alias("t", "test")
    .argv;

async function run() {
    if(!argv.publics) throw new Error("Publics path needs to be provided!");
    if(!argv.test) throw new Error("Test file needs to be provided!");
    const publicsPath = argv.publics;
    const testFile = argv.test;
    const publics = JSON.parse(await fs.promises.readFile(path.join(process.cwd(), publicsPath), "utf8"));
    const template = await fs.promises.readFile(path.join(process.cwd(), "test", "final", "gen_final_test.ejs"), "utf8");
    const test = ejs.render(template, { publicsPath, publics });

    await fs.promises.writeFile(testFile, test, "utf8");
}

run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});
