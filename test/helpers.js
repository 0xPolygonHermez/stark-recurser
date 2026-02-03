const { scalar2fea } = require("@0xpolygonhermez/zkevm-commonjs/src/smt-utils");
const { F1Field, Scalar } = require("ffjavascript");

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

    for (const def of publicsInfo.definitions) {
        const name = def.name;

        publicsA[name] = Array.from({ length: def.size }, () => generateRandom32());
        publicsB[name] = Array.from({ length: def.size }, () => generateRandom32());

        const source = def.aggregation === "prev" ? publicsA : publicsB;
        publicsAggregated[name] = source[name];
    }

    for (const check of publicsInfo.checks) {
        const operator = Object.keys(check)[0]; // e.g., "equal"
        const [fullName1, fullName2] = check[operator];
        const [prefix1, name1] = fullName1.split(".");
        const [prefix2, name2] = fullName2.split(".");

        const source = prefix1 === "prev" ? publicsA : publicsB;
        const target = prefix2 === "prev" ? publicsA : publicsB;

        if (operator === "equal") {
            target[name2] = [...source[name1]];
        } else {
            throw new Error(`Unsupported operator in test generation: ${operator}`);
        }
    }

    return {
        publicsA,
        publicsB,
        publicsAggregated,
        circomPublicsA: preparePublics(publicsA, publicsInfo),
        circomPublicsB: preparePublics(publicsB, publicsInfo),
        circomPublicsAggregated: preparePublics(publicsAggregated, publicsInfo),
    };
};

function generateRandom32(forbidden = null) {
    let value = Math.floor(Math.random() * 0x100000000); // 0 to 2^32-1
    if (forbidden !== null) {
        while (value === forbidden) {
            value = Math.floor(Math.random() * 0x100000000);
        }
    }
    return value;
}

function preparePublics(publics, publicsInfo) {
    const Fr = new F1Field(0xffffffff00000001n);
    const publicsCircom = new Array(publicsInfo.nPublics);

    for (const def of publicsInfo.definitions) {
        const pos = def.pos;
        const size = def.size;
        const values = publics[def.name];

        for (let j = 0; j < size; j++) {
            publicsCircom[pos + j] = Fr.e(values[j]);
        }
    }

    return publicsCircom;
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

module.exports.generateRandom32 = generateRandom32;
module.exports.generateRandomHex = generateRandomHex;
module.exports.preparePublics = preparePublics;