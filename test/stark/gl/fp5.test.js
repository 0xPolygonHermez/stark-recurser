const path = require("path");
const F5g = require("../../../src/utils/f5g.js");

const wasm_tester = require("circom_tester").wasm;

describe("Fp5 arithmetic over GL", function () {
    let K;
    let g;
    let base_dir;

    this.timeout(10000000);

    before(async () => {
        K = new F5g();
        g = K.g;
        base_dir = path.join(__dirname, "circom/fp5");
    });

    it("Should check Fp5 addition", async () => {
        circuit = await wasm_tester(path.join(base_dir, "add.test.circom"), { prime: "goldilocks" });

        for (let i = 0; i < 256; i++) {
            const input = {
                a: K.random(),
                b: K.random(),
            };

            const witness = await circuit.calculateWitness(input, true);

            await circuit.checkConstraints(witness);
            await circuit.assertOut(witness, { a_plus_b: K.add(input.a, input.b) });
        }
    });
});
