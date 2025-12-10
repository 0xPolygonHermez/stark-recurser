const chai = require("chai");
const path = require("path");

const wasm_tester = require("circom_tester").wasm;

describe("Poseidon2 Circuit Test", function () {
    let circuit;

    this.timeout(10000000);

    before( async() => {
        circuit = await wasm_tester(path.join(__dirname, "circom", "poseidon2_1.test.circom"), {O:1, verbose: true, prime: "goldilocks"});
    });

    it("Should calculate poseidon2 with 4 elements", async () => {

        const input={
            in: [0,1,2,3],
        };

        const w = await circuit.calculateWitness(input, true);
        
        const res = [
            8466914293353944746n,
            9589318970755021278n,
            5769801005587200741n,
            17288820341814263849n
        ];

        await circuit.assertOut(w, {out: res });
    });
});
