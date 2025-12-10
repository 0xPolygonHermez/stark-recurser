const chai = require("chai");
const path = require("path");

const wasm_tester = require("circom_tester").wasm;

describe("VerifyPow Circuit Test", function () {
    let circuit;

    this.timeout(10000000);

    before( async() => {
        circuit = await wasm_tester(path.join(__dirname, "circom", "verify_pow.test.circom"), {O:1, verbose: true, prime: "goldilocks"});
    });

    it("Should verify proof of work with 1 leading zero bit", async () => {

        const input={
            challengeFRIQueries: [0,1,2],
            nonce: 3,
        };

        const w = await circuit.calculateWitness(input, true);
        
        await circuit.assertOut(w, {});
    });
});
