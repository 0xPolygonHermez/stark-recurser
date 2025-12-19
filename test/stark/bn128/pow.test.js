const path = require("path");
const wasm_tester = require("circom_tester").wasm;

describe("Pow Circuit Test", function () {
    let circuit;

    this.timeout(10000000);

    before( async() => {
        circuit = await wasm_tester(path.join(__dirname, "circom", "pow.test.circom"), {include: ["src/pil2circom/circuits.bn128", "node_modules/circomlib/circuits"]});
    });

    it("Should calculate oow", async () => {
        
        const input={
            challengeFRIQueries: [10242218135831375165n,1938454147710421592n,6492945273541570343n],
            nonce: 24303n,
            enable: 1,
        };


        await circuit.calculateWitness(input, true);

    });
});
