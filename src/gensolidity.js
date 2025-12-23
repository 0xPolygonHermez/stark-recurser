const fs = require("fs");
const ejs = require("ejs");
const path = require("path");

module.exports.genSolidity = async function genSolidity(name, publics, useFflonk = false) {    
    const optionsSolidity = {
        name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
        publics,
        useFflonk
    };

    const templateFile = path.resolve(__dirname,"recursion/contracts/verifier.sol.ejs");
    const solidityTemplate = await fs.promises.readFile(templateFile, "utf8");
    const solidityVerifier = ejs.render(solidityTemplate, optionsSolidity, { views: [path.join(__dirname, "..")] });

    const templateFileInterface = path.resolve(__dirname,"recursion/contracts/iverifier.sol.ejs");
    const solidityTemplateInterface = await fs.promises.readFile(templateFileInterface, "utf8");
    const solidityVerifierInterface = ejs.render(solidityTemplateInterface, optionsSolidity, { views: [path.join(__dirname, "..")] });
    return { solidityVerifier, solidityVerifierInterface };
}