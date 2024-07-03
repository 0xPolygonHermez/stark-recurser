const { scalar2fea } = require("@0xpolygonhermez/zkevm-commonjs/src/smt-utils");
const { F1Field, Scalar } = require("ffjavascript");

function preparePublics(publics, publicsInfo) {
    const Fr = new F1Field(0xffffffff00000001n);

    const publicsCircom = new Array(publicsInfo.nPublics);

    for(let i = 0; i < publicsInfo.definitions.length; i++) {
        const name = publicsInfo.definitions[i].name;
        const initialPos = publicsInfo.definitions[i].initialPos;
        const length = i === publicsInfo.definitions.length - 1 
                ? publicsInfo.nPublics - initialPos
                : publicsInfo.definitions[i + 1].initialPos - initialPos;
        const value = publics[name];
        if(length === 1) {
            publicsCircom[initialPos] = Fr.e(value);
        } else if(length === 8) {
            const circomInputs = scalar2fea(Fr, Scalar.e(value));
            for(let j = 0; j < circomInputs.length; j++) {
                publicsCircom[initialPos + j] = circomInputs[j];
            }
        } else throw new Error("Unsupported length: ", + length);

    }

    return publicsCircom;
}

module.exports.generatePublics = function generatePublics(aggregatorAddress, publicsInfo) {
    const publics = {};
    const publicsSolidity = [];
    const publicsSolidityTypes = [];
    for(let i = 0; i < publicsInfo.definitions.length; ++i) {
        const def = publicsInfo.definitions[i];
        const name = def.name;
        const nChunks = def.chunks[0];
        const nBitsPerChunk = def.chunks[1];
        let nBits = nChunks * nBitsPerChunk;
        if(def.avoidAlias) nBits -= 1;
        publics[name] = generateRandomHex(nBits);
        publicsSolidity.push(publics[name]);
        publicsSolidityTypes.push(`uint${nChunks * nBitsPerChunk}`);
    }

    publicsSolidity.push(aggregatorAddress);
    publicsSolidityTypes.push("address");

    return { publics, publicsSolidity, publicsSolidityTypes }
}

module.exports.generatePublicsAggregation = function generatePublicsAggregation(publicsInfo) {

    const publicsA = {};
    const publicsB = {};
    const publicsAggregated = {};

    for(let i = 0; i < publicsInfo.definitions.length; ++i) {
        const def = publicsInfo.definitions[i];
        const name = def.name;
        const prevSource = def.prevSource;
        publicsA[name] = generateRandomHex(63);
        publicsB[name] = generateRandomHex(63);
        if(prevSource) {
            publicsAggregated[name] = publicsA[name];
        } else {
            publicsAggregated[name] = publicsB[name];
        }
    }

    for(let i = 0; i < publicsInfo.checks.length; ++i) {
        let check = publicsInfo.checks[i];
        publicsB[check[1]] = publicsA[check[0]];
    }   

    
    return { 
        publicsA, 
        publicsB, 
        publicsAggregated, 
        circomPublicsA: preparePublics(publicsA, publicsInfo), 
        circomPublicsB: preparePublics(publicsB, publicsInfo),
        circomPublicsAggregated: preparePublics(publicsAggregated, publicsInfo),
    };
}

function generateRandomHex(maxBits = 32, forbiddenHex = null) {
    let maxValue = Math.pow(2, maxBits);
    let hexValue = '0x' + Math.floor(Math.random() * maxValue).toString(16);
    if(forbiddenHex) {
        while(hexValue === forbiddenHex) {
            hexValue = '0x' + Math.floor(Math.random() * maxValue).toString(16);
        }
    }
    return hexValue;
}

module.exports.generateRandomHex = generateRandomHex;
module.exports.preparePublics = preparePublics;