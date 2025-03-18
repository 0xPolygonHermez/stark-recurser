const path = require("path");
const F5g = require("../../../src/utils/f5g.js");
const { assert } = require("chai");

const wasm_tester = require("circom_tester").wasm;

let K = new F5g();

function is_on_curve(A, B, P) {
    let [x, y] = [P[0], P[1]];
    let lhs = K.square(y);
    let rhs = K.add(K.add(K.mul(K.mul(x, x), x), K.mul(A, x)), B);
    return K.eq(lhs, rhs);
}

describe("Elliptic curve arithmetic over the fifth extension of GL", function () {
    let g;
    let base_dir;

    this.timeout(10000000);

    before(async () => {
        g = K.g;
        base_dir = path.join(__dirname, "circom/ec");
    });

    describe("Should check EcGFp5 arithmetic", async () => {
        let G;
        let A, B;
        before(async () => {
            G = [
                [0n, 0n, 0n, 0n, 0n],
                [
                    11002749681768771274n,
                    11642892185553879191n,
                    663487151061499164n,
                    2764891638068209098n,
                    2343917403129570002n,
                ],
            ];

            A = [6148914689804861439n, 263n, 0n, 0n, 0n];
            B = [15713893096167979237n, 6148914689804861265n, 0n, 0n, 0n];

            assert(is_on_curve(A, B, G), "G is not on the curve");
        });

        it("Should check point doubling", async () => {
            let circuit = await wasm_tester(
                path.join(base_dir, "ecgfp5_double.test.circom"),
                { prime: "goldilocks" }
            );

            // G + G
            let input = {
                P: G,
            };

            let witness = await circuit.calculateWitness(input, true);

            await circuit.checkConstraints(witness);

            let R_real = [
                [
                    15622315679105259n,
                    9233938668908914291n,
                    14943848313873695123n,
                    1210072233909776598n,
                    2930298871824402754n,
                ],
                [
                    4471391967326616314n,
                    15391191233422108365n,
                    12545589738280459763n,
                    18441655962801752599n,
                    12893054396778703652n,
                ],
            ];
            assert(is_on_curve(A, B, R_real), "R is not on the curve");
            await circuit.assertOut(witness, { R: R_real });
        });

        it("Should check point addition", async () => {
            let circuit = await wasm_tester(
                path.join(base_dir, "add.test.circom"),
                { prime: "goldilocks" }
            );

            // G + G + G
            let input = {
                P: G,
                Q: [
                    [
                        15622315679105259n,
                        9233938668908914291n,
                        14943848313873695123n,
                        1210072233909776598n,
                        2930298871824402754n,
                    ],
                    [
                        4471391967326616314n,
                        15391191233422108365n,
                        12545589738280459763n,
                        18441655962801752599n,
                        12893054396778703652n,
                    ],
                ],
            };

            let witness = await circuit.calculateWitness(input, true);

            await circuit.checkConstraints(witness);

            let R_real = [
                [
                    6535296575033610464n,
                    10296938272802226861n,
                    6062249350014962804n,
                    177124804235033586n,
                    7276441891717506516n,
                ],
                [
                    18178031365678595731n,
                    11606916788478585122n,
                    6488177608160934983n,
                    12544791818053125737n,
                    14568464258697035512n,
                ],
            ];
            assert(is_on_curve(A, B, R_real), "R is not on the curve");
            await circuit.assertOut(witness, { R: R_real });
        });

        // TODO: Finish when available
        // it("Should check hash to group", async () => {
        //     let circuit = await wasm_tester(
        //         path.join(base_dir, "ecgfp5_hash.test.circom"),
        //         { prime: "goldilocks" }
        //     );

        //     let r = K.random();
        //     let input = {
        //         x: r,
        //         y: K.add(r, 1n),
        //     };

        //     witness = await circuit.calculateWitness(input, true);

        //     await circuit.checkConstraints(witness);
        // });
    });

    describe("Should check EcMasFp5 arithmetic", async () => {
        let G;
        let A, B;
        before(async () => {
            G = [
                [0n, 0n, 0n, 0n, 0n],
                [0n, 0n, 18446741870424883713n, 0n, 0n],
            ];

            A = [3n, 0n, 0n, 0n, 0n];
            B = [0n, 0n, 0n, 0n, 8n];

            assert(is_on_curve(A, B, G), "G is not on the curve");
        });

        it("Should check point doubling", async () => {
            let circuit = await wasm_tester(
                path.join(base_dir, "ecmasfp5_double.test.circom"),
                { prime: "goldilocks" }
            );

            // G + G
            let input = {
                P: G,
            };

            let witness = await circuit.calculateWitness(input, true);

            await circuit.checkConstraints(witness);

            let R_real = [
                [0n, 16717361812906967041n, 0n, 0n, 0n],
                [0n, 0n, 2198989700608n, 0n, 12884705277n],
            ];
            assert(is_on_curve(A, B, R_real), "R is not on the curve");
            await circuit.assertOut(witness, { R: R_real });
        });

        it("Should check point addition", async () => {
            let circuit = await wasm_tester(
                path.join(base_dir, "add.test.circom"),
                { prime: "goldilocks" }
            );

            // G + G + G
            let input = {
                P: G,
                Q: [
                    [0n, 16717361812906967041n, 0n, 0n, 0n],
                    [0n, 0n, 2198989700608n, 0n, 12884705277n],
                ]
            };

            let witness = await circuit.calculateWitness(input, true);

            await circuit.checkConstraints(witness);

            let R_real = [
                [0n, 0n, 14347467609544680335n, 0n, 12297829379609722902n],
                [
                    18442240538507739137n,
                    0n,
                    18446737472445482497n,
                    17592730746524804590n,
                    0n,
                ],
            ];
            assert(is_on_curve(A, B, R_real), "R is not on the curve");
            await circuit.assertOut(witness, { R: R_real });
        });

        // TODO: Finish when available
        // it("Should check hash to group", async () => {
        //     let circuit = await wasm_tester(
        //         path.join(base_dir, "ecmasfp5_hash.test.circom"),
        //         { prime: "goldilocks" }
        //     );

        //     let r = K.random();
        //     let input = {
        //         x: r,
        //         y: K.add(r, 1n),
        //     };

        //     witness = await circuit.calculateWitness(input, true);

        //     await circuit.checkConstraints(witness);
        // });
    });
});
