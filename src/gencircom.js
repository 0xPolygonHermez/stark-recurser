const fs = require("fs");
const ejs = require("ejs");

module.exports.genCircom = async function genCircom(templateFile, starkInfos = [], vadcopInfo = {}, verifierFilenames = [], basicVerificationKeys = [], aggVerificationKeys = [], publics = []) {    
    const optionsCircom = {
        options: {}
    };

    if(starkInfos.length === 1) {
        optionsCircom.starkInfo = starkInfos[0];
    } else {
        optionsCircom.starkInfo = starkInfos;
    }

    if(basicVerificationKeys.length === 1) {
        optionsCircom.basicVK = basicVerificationKeys[0];
    } else {
        optionsCircom.basicVK = basicVerificationKeys;
    }

    if(aggVerificationKeys.length === 1) {
        optionsCircom.aggregatedVK = aggVerificationKeys[0];
    } else {
        optionsCircom.aggregatedVK = aggVerificationKeys;
    }

    if(verifierFilename.length === 1) {
        optionsCircom.verifierFilename = verifierFilenames[0];
    } else {
        optionsCircom.verifierFilename = verifierFilenames;
    }

    if(publics.length === 1) {
        optionsCircom.publics = publics[0];
    } else {
        optionsCircom.publics = publics;
    }

    optionsCircom.vadcopInfo = vadcopInfo;

    const circomTemplate = await fs.promises.readFile(templateFile, "utf8");
    const circomVerifier = ejs.render(circomTemplate, optionsCircom, { views: [process.cwd()]});
    
    return circomVerifier;
}