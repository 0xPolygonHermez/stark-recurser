const chai = require("chai");
const path = require("path");

const wasm_tester = require("circom_tester").wasm;

describe("Poseidon2 Circuit Test", function () {
    let circuit;

    this.timeout(10000000);

    before( async() => {
        circuit = await wasm_tester(path.join(__dirname, "circom", "poseidon2.test.circom"), {O:1, prime: "goldilocks"});
    });

    it("Should calculate poseidon2", async () => {

        const input={
            in: [0,1,2,3,4,5,6,7],
            capacity: [8,9,10,11]
        };

        const w = await circuit.calculateWitness(input, true);
        
        await circuit.assertOut(w, {out: [138186169299091649n, 2237493815125627916n, 7098449130000758157n, 16681569560651424230n] });
    });
});
