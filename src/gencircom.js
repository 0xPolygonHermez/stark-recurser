const fs = require("fs");
const ejs = require("ejs");
const path = require("path");
const util = require('util');
const childProcess = require('child_process'); // Split into two lines for clarity
const exec = util.promisify(childProcess.exec);

module.exports.genCircom = async function genCircom(filename, buildDir, aggregationType, template, starkInfos = [], vadcopInfo = {}, verifierFilenames = [], basicVerificationKeys = [], aggVerificationKeys = [], publics = [], options = {}) {    
    const optionsCircom = {
        options
    };

    if(!isNaN(options.airgroupId)) {
        optionsCircom.airgroupId = options.airgroupId;
    }

    if(starkInfos.length === 1) {
        optionsCircom.starkInfo = starkInfos[0];
    } else {
        optionsCircom.starkInfo = starkInfos;
    }

    if(publics.length === 1) {
        optionsCircom.publics = publics[0];
    } else {
        optionsCircom.publics = publics;
    }

    optionsCircom.basicVK = basicVerificationKeys;
    optionsCircom.aggregatedVK = aggVerificationKeys;
    optionsCircom.verifierFilenames = verifierFilenames;
    optionsCircom.vadcopInfo = vadcopInfo;

    let templateFile = `${path.join(__dirname, aggregationType, "templates", template)}.circom.ejs`;
    const circomTemplate = await fs.promises.readFile(templateFile, "utf8");
    const circomVerifier = ejs.render(circomTemplate, optionsCircom, { views: [path.join(__dirname, "..")] });
    
    await fs.promises.writeFile(filename, circomVerifier, "utf8");

    const circuitsGLPath = path.resolve(__dirname, 'pil2circom/circuits.gl');
    const starkRecurserCircuits = path.resolve(__dirname, `/${aggregationType}/helpers/circuits`);

    // Compile circom
    console.log("Compiling " + filename + "...");
    const compileFinalCommand = `circom --O1 --r1cs --prime goldilocks --inspect --wasm --c --verbose -l ${starkRecurserCircuits} -l ${circuitsGLPath} ${filename} -o ${buildDir}/build`;
    const execCompile = await exec(compileFinalCommand);
    console.log(execCompile.stdout);

    return circomVerifier;
}