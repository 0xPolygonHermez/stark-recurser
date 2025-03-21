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
    let infinity;

    this.timeout(10000000);

    before(async () => {
        g = K.g;
        base_dir = path.join(__dirname, "circom/ec");
        infinity = [[K.zero, K.zero, K.zero, K.zero, K.zero], [K.zero, K.zero, K.zero, K.zero, K.zero]];
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

            // 𝒪 + 𝒪
            let input = {
                P: infinity,
                Q: infinity,
            };

            let witness = await circuit.calculateWitness(input, true);

            await circuit.checkConstraints(witness);
            await circuit.assertOut(witness, { R: infinity });

            // NOT HANDLED BY THE CIRCUIT
            // // 𝒪 + G
            // input = {
            //     P: infinity,
            //     Q: G,
            // };

            // witness = await circuit.calculateWitness(input, true);

            // await circuit.checkConstraints(witness);
            // await circuit.assertOut(witness, { R: infinity });

            // NOT HANDLED BY THE CIRCUIT
            // // G + 𝒪
            // input = {
            //     P: G,
            //     Q: infinity,
            // };

            // witness = await circuit.calculateWitness(input, true);
            // let output = await circuit.getOutput(witness, {
            //     R: [2, 5],
            // });
            // console.log(output);

            // await circuit.checkConstraints(witness);
            // await circuit.assertOut(witness, { R: G });

            // G + G + G
            input = {
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

            witness = await circuit.calculateWitness(input, true);

            await circuit.checkConstraints(witness);

            R_real = [
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

        it("Should check hash to group", async () => {
            let circuit = await wasm_tester(
                path.join(base_dir, "ecgfp5_hash.test.circom"),
                { prime: "goldilocks" }
            );

            // 1
            let input = {
                x: [K.one, K.zero, K.zero, K.zero, K.zero],
                y: g,
            };

            let witness = await circuit.calculateWitness(input, true);
            await circuit.checkConstraints(witness);

            let R_real = [
                [
                    7034281690888675210n,
                    10021905067448256112n,
                    8847084513512595894n,
                    12034058372761676419n,
                    6357873877792296012n,
                ],
                [
                    12019212881058414420n,
                    4156549635528540099n,
                    1302960608957397946n,
                    18395048564242130068n,
                    12046748790279728118n,
                ],
            ];

            assert(is_on_curve(A, B, R_real), "R is not on the curve");
            await circuit.assertOut(witness, { R: R_real });

            // 2
            input = {
                x: [
                    9052142224248848544n,
                    17160939908669049738n,
                    16771734809406254918n,
                    11740325376785256970n,
                    6450405707241178490n,
                ],
                y: [
                    15468571987580459907n,
                    4075162626615025911n,
                    14162621674256394387n,
                    17422297713922717328n,
                    16467343951173112442n,
                ],
            };

            witness = await circuit.calculateWitness(input, true);
            await circuit.checkConstraints(witness);

            R_real = [
                [
                    5602792340984424871n,
                    15160485047939050929n,
                    13388387164646829606n,
                    12297073975898957547n,
                    16718324919897100610n,
                ],
                [
                    5478316629929441317n,
                    8529584332160948154n,
                    16710896842091379961n,
                    6508516180086339962n,
                    11858871076876104487n,
                ],
            ];

            assert(is_on_curve(A, B, R_real), "R is not on the curve");
            await circuit.assertOut(witness, { R: R_real });

            // 3
            input = {
                x: [
                    7226199469085349115n,
                    3811860589880905711n,
                    4244339383161593215n,
                    7458051520645108784n,
                    944081707254158527n,
                ],
                y: [
                    8651278690391322537n,
                    4030849371852686303n,
                    9585439905725133798n,
                    4759083085883399182n,
                    9524839408842337974n,
                ],
            };

            witness = await circuit.calculateWitness(input, true);
            await circuit.checkConstraints(witness);

            R_real = [
                [
                    8646856075942374336n,
                    5531974911105575665n,
                    785297002128929805n,
                    2548862424144547729n,
                    2936278341774753320n,
                ],
                [
                    17085688595165691935n,
                    3577417642620925570n,
                    3941281622352127440n,
                    8058605739021270957n,
                    12192510923030057980n,
                ],
            ];

            assert(is_on_curve(A, B, R_real), "R is not on the curve");
            await circuit.assertOut(witness, { R: R_real });

            // Random tests
            for (let i = 0; i < 256; i++) {
                let x = K.random();
                let y = K.random();
                while (K.eq(x, y)) {
                    y = K.random();
                }
                let input = {
                    x: x,
                    y: y,
                };

                let witness = await circuit.calculateWitness(input, true);
                await circuit.checkConstraints(witness);
                let output = await circuit.getOutput(witness, {
                    R: [2, 5],
                });

                assert(is_on_curve(A, B, output.R), "R is not on the curve");
            }
        });
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

            // 𝒪 + 𝒪
            let input = {
                P: infinity,
                Q: infinity,
            };

            let witness = await circuit.calculateWitness(input, true);

            await circuit.checkConstraints(witness);
            await circuit.assertOut(witness, { R: infinity });

            // NOT HANDLED BY THE CIRCUIT
            // // 𝒪 + G
            // input = {
            //     P: infinity,
            //     Q: G,
            // };

            // witness = await circuit.calculateWitness(input, true);

            // await circuit.checkConstraints(witness);
            // await circuit.assertOut(witness, { R: G, is_R_inf: 0 });

            // NOT HANDLED BY THE CIRCUIT
            // // G + 𝒪
            // input = {
            //     P: G,
            //     Q: infinity,
            // };

            // witness = await circuit.calculateWitness(input, true);

            // await circuit.checkConstraints(witness);
            // await circuit.assertOut(witness, { R: G, is_R_inf: 0 });

            // G + G + G
            input = {
                P: G,
                Q: [
                    [0n, 16717361812906967041n, 0n, 0n, 0n],
                    [0n, 0n, 2198989700608n, 0n, 12884705277n],
                ],
            };

            witness = await circuit.calculateWitness(input, true);

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

        it("Should check hash to group", async () => {
            let circuit = await wasm_tester(
                path.join(base_dir, "ecmasfp5_hash.test.circom"),
                { prime: "goldilocks" }
            );

            // 1
            let input = {
                x: [K.one, K.zero, K.zero, K.zero, K.zero],
                y: g,
            };

            let witness = await circuit.calculateWitness(input, true);
            await circuit.checkConstraints(witness);

            let R_real = [
                [
                    10259910588131587130n,
                    286383041733242099n,
                    2206146858909993796n,
                    762191754947529122n,
                    8385908694651882447n,
                ],
                [
                    17264224020705962262n,
                    13784877511211974122n,
                    16640455266171883167n,
                    7921609470191942242n,
                    4808859899355583917n,
                ],
            ];

            assert(is_on_curve(A, B, R_real), "R is not on the curve");
            await circuit.assertOut(witness, { R: R_real });

            // 2
            input = {
                x: [
                    9032969693988546383n,
                    8651213878054621585n,
                    13124816408900721378n,
                    3370331344893337754n,
                    11645558547211108125n,
                ],
                y: [
                    16568132721862920798n,
                    3394595134803192564n,
                    9838431992020534090n,
                    3071425502358751872n,
                    14534862838718893336n,
                ],
            };

            witness = await circuit.calculateWitness(input, true);
            await circuit.checkConstraints(witness);

            R_real = [
                [
                    15682160960464048388n,
                    10861067190246274764n,
                    10814751896300516054n,
                    17675598187799243193n,
                    3574276616263426478n,
                ],
                [
                    5127580244229524939n,
                    16134649663433468944n,
                    5441891096456225412n,
                    1904581438123605057n,
                    14067899908652822139n,
                ],
            ];

            assert(is_on_curve(A, B, R_real), "R is not on the curve");
            await circuit.assertOut(witness, { R: R_real });

            // 3
            input = {
                x: [
                    17440009270280327798n,
                    17554975214772350541n,
                    7705723362424160909n,
                    9012494519071781861n,
                    11980924154765420841n,
                ],
                y: [
                    12992603241246077294n,
                    14631410589821784168n,
                    11183259769496927995n,
                    12007727135053086834n,
                    3853258726780359605n,
                ],
            };

            witness = await circuit.calculateWitness(input, true);
            await circuit.checkConstraints(witness);

            R_real = [
                [
                    3939717732648775158n,
                    1983912089720954028n,
                    7115635220069055355n,
                    12255369595030197645n,
                    719489304914337152n,
                ],
                [
                    13948426812708477332n,
                    7416718153409685481n,
                    13520740257743666320n,
                    13986885095611076870n,
                    9563256848002327167n,
                ],
            ];

            assert(is_on_curve(A, B, R_real), "R is not on the curve");
            await circuit.assertOut(witness, { R: R_real });

            // Random tests
            for (let i = 0; i < 256; i++) {
                let x = K.random();
                let y = K.random();
                while (K.eq(x, y)) {
                    y = K.random();
                }
                let input = {
                    x: x,
                    y: y,
                };

                let witness = await circuit.calculateWitness(input, true);
                await circuit.checkConstraints(witness);
                let output = await circuit.getOutput(witness, {
                    R: [2, 5],
                });

                assert(is_on_curve(A, B, output.R), "R is not on the curve");
            }
        });
    });
});
