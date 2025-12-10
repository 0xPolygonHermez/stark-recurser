const chai = require("chai");
const path = require("path");
const tmp = require('temporary');
const fs = require("fs");
const ejs = require("ejs");
const assert = chai.assert;

const wasm_tester = require("circom_tester").wasm;


describe("SelectVal Circuit Test", function () {
    let template;

    this.timeout(10000000);

    before( async() => {
        template = await fs.promises.readFile(path.join(__dirname, "circom", "selectvalue.test.circom.ejs"), "utf8");
    });

    it(`Should calculate tree selector with 2 levels`, async () => {
        const nLevels = 2;
        const content = ejs.render(template, {nLevels, dirName:path.join(__dirname, "circom")});
        const circuitFile = path.join(new tmp.Dir().path, "circuit.circom");
        await fs.promises.writeFile(circuitFile, content);
        let circuit = await wasm_tester(circuitFile, {O:1, prime: "goldilocks"});

        const N = 4**nLevels;

        const values = [];
        for (let j=0; j<N; j++) {
            for (let k=0; k<4; k++) {
                values[4*j + k] = BigInt(j*100 + k);
            }
        }

        for(let j = 0; j < N; ++j) {
            const input={
                values: values,
                key: j,
            };
            
            const w1 = await circuit.calculateWitness(input, true);
            
            await circuit.assertOut(w1, {out: values.slice(4*j, 4*j+4)});
        }
    });

    it(`Should calculate tree selector with 3 levels`, async () => {
        const nLevels = 3;
        const content = ejs.render(template, {nLevels, dirName:path.join(__dirname, "circom")});
        const circuitFile = path.join(new tmp.Dir().path, "circuit.circom");
        await fs.promises.writeFile(circuitFile, content);
        let circuit = await wasm_tester(circuitFile, {O:1, prime: "goldilocks"});

        const N = 4**nLevels;

        const values = [];
        for (let j=0; j<N; j++) {
            for (let k=0; k<4; k++) {
                values[4*j + k] = BigInt(j*100 + k);
            }
        }

        for(let j = 0; j < N; ++j) {
            const input={
                values: values,
                key: j,
            };
            
            const w1 = await circuit.calculateWitness(input, true);
            
            await circuit.assertOut(w1, {out: values.slice(4*j, 4*j+4)});
        }
    });
    
});
