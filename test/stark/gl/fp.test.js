const path = require("path");
const { F1Field } = require("ffjavascript");

const wasm_tester = require("circom_tester").wasm;

describe("Fp arithmetic over GL", function () {
    let F;
    let g;
    let circuit;

    this.timeout(10000000);

    before(async () => {
        F = new F1Field(0xffffffff00000001n);
        g = F.e(7);
        circuit = await wasm_tester(path.join(__dirname, "circom", "fp.test.circom"), { prime: "goldilocks" });
    });

    it("Should check the is_square method", async () => {
        let x = F.one;
        for (let i = 0; i < 1000; i++) {
            const input = {
                a: x,
            };

            const witness = await circuit.calculateWitness(input, true);

            await circuit.checkConstraints(witness);
            await circuit.assertOut(witness, { is_square: (i % 2 == 0) ? 1 : 0 });

            x = F.mul(x, g);
        }

    });
});
