const path = require("path");
const F5g = require("../../../src/utils/f5g.js");
const assert = require("chai").assert;

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
        circuit = await wasm_tester(path.join(base_dir, "add.test.circom"), {
            prime: "goldilocks",
        });

        for (let i = 0; i < 256; i++) {
            const input = {
                a: K.random(),
                b: K.random(),
            };

            const witness = await circuit.calculateWitness(input, true);

            await circuit.checkConstraints(witness);
            await circuit.assertOut(witness, {
                a_plus_b: K.add(input.a, input.b),
            });
        }
    });

    it("Should check Fp5 division", async () => {
        circuit = await wasm_tester(path.join(base_dir, "div.test.circom"), {
            prime: "goldilocks",
        });

        for (let i = 0; i < 256; i++) {
            let input = {
                a: K.random(),
                b: K.zero,
            };
            while (K.isZero(input.b)) {
                input.b = K.random();
            }

            const witness = await circuit.calculateWitness(input, true);
            let output = await circuit.getOutput(witness, { a_div_b: 5 });
            let a_div_b = output.a_div_b;

            await circuit.checkConstraints(witness);
            assert.deepEqual(input.a, K.mul(input.b, a_div_b));
        }
    });

    it("Should check Fp5 inversion", async () => {
        circuit = await wasm_tester(path.join(base_dir, "inv.test.circom"), {
            prime: "goldilocks",
        });

        for (let i = 0; i < 256; i++) {
            let input = {
                a: K.random(),
                b:
                    i === 0
                        ? [K.zero, K.zero, K.zero, K.zero, K.zero]
                        : K.random(),
            };
            if (i > 0) {
                while (K.isZero(input.b)) {
                    input.b = K.random();
                }
            }

            const witness = await circuit.calculateWitness(input, true);
            let output = await circuit.getOutput(witness, {
                a_inv: 5,
                b_inv: 5,
            });
            let a_div = output.a_inv;
            let b_div = output.b_inv;

            await circuit.checkConstraints(witness);
            assert.deepEqual(
                [K.one, K.zero, K.zero, K.zero, K.zero],
                K.mul(input.a, a_div)
            );
            assert.deepEqual(
                i == 0
                    ? [K.zero, K.zero, K.zero, K.zero, K.zero]
                    : [K.one, K.zero, K.zero, K.zero, K.zero],
                K.mul(input.b, b_div)
            );
        }
    });

    it("Should check Fp5 is_square method", async () => {
        circuit = await wasm_tester(
            path.join(base_dir, "is_square.test.circom"),
            { prime: "goldilocks" }
        );

        let x = [K.one, K.zero, K.zero, K.zero, K.zero];
        for (let i = 0; i < 256; i++) {
            let input = {
                a: x,
            };

            const witness = await circuit.calculateWitness(input, true);

            await circuit.checkConstraints(witness);
            await circuit.assertOut(witness, {
                a_is_square: i % 2 == 0 ? 1 : 0,
            });

            x = K.mul(x, g);
        }
    });

    it("Should check Fp5 is_zero method", async () => {
        circuit = await wasm_tester(
            path.join(base_dir, "is_zero.test.circom"),
            { prime: "goldilocks" }
        );

        for (let i = 0; i < 256; i++) {
            let value;
            switch (i) {
                case 0:
                    value = [K.zero, K.zero, K.zero, K.zero, K.zero];
                    break;
                case 1:
                    value = [K.one, K.zero, K.zero, K.zero, K.zero];
                    break;
                case 2:
                    value = [K.negone, K.zero, K.zero, K.zero, K.zero];
                    break;
                default:
                    value = K.random();
                    while (K.isZero(value)) {
                        value = K.random();
                    }
            }
            let input = {
                a: value,
            };

            const witness = await circuit.calculateWitness(input, true);

            await circuit.checkConstraints(witness);
            await circuit.assertOut(witness, { a_is_zero: i == 0 ? 1 : 0 });
        }
    });

    it("Should check Fp5 multiplication", async () => {
        circuit = await wasm_tester(path.join(base_dir, "mul.test.circom"), {
            prime: "goldilocks",
        });

        for (let i = 0; i < 256; i++) {
            const input = {
                a: K.random(),
                b: K.random(),
            };

            const witness = await circuit.calculateWitness(input, true);

            await circuit.checkConstraints(witness);
            await circuit.assertOut(witness, {
                a_mul_b: K.mul(input.a, input.b),
            });
        }
    });

    it("Should check Fp5 negation", async () => {
        circuit = await wasm_tester(path.join(base_dir, "neg.test.circom"), {
            prime: "goldilocks",
        });

        for (let i = 0; i < 256; i++) {
            let input = {
                a: K.random(),
            };

            const witness = await circuit.calculateWitness(input, true);

            await circuit.checkConstraints(witness);
            await circuit.assertOut(witness, {
                a_neg: K.neg(input.a, input.b),
            });
        }
    });

    it("Should check Fp5 sign", async () => {
        circuit = await wasm_tester(path.join(base_dir, "sign.test.circom"), {
            prime: "goldilocks",
        });

        for (let i = 0; i < 256; i++) {
            let input = {
                a:
                    i == 0
                        ? [K.zero, K.zero, K.zero, K.zero, K.zero]
                        : K.random(),
            };

            let a_sign = 0;
            for (let j = 0; j < 5; j++) {
                let aj = input.a[j];
                if (aj != 0) {
                    a_sign = aj % 2n;
                    break;
                }
            }

            const witness = await circuit.calculateWitness(input, true);

            await circuit.checkConstraints(witness);
            await circuit.assertOut(witness, { a_sign });
        }
    });

    it("Should check Fp5 sqrt", async () => {
        circuit = await wasm_tester(path.join(base_dir, "sqrt.test.circom"), {
            prime: "goldilocks",
        });

        for (let i = 0; i < 256; i++) {
            let value;
            switch (i) {
                case 0:
                    value = [K.zero, K.zero, K.zero, K.zero, K.zero];
                    break;
                case 1:
                    value = [K.one, K.zero, K.zero, K.zero, K.zero];
                    break;
                default:
                    value = K.random();
                    while (K.isZero(value)) {
                        value = K.random();
                    }
            }
            let input = {
                a: K.square(value),
            };

            const witness = await circuit.calculateWitness(input, true);
            let output = await circuit.getOutput(witness, { a_sqrt: 5 });
            let a_sqrt = output.a_sqrt;

            await circuit.checkConstraints(witness);
            assert.deepEqual(input.a, K.mul(a_sqrt, a_sqrt));
        }
    });

    it("Should check Fp5 square", async () => {
        circuit = await wasm_tester(path.join(base_dir, "square.test.circom"), {
            prime: "goldilocks",
        });

        for (let i = 0; i < 256; i++) {
            let input = {
                a: K.random(),
            };

            const witness = await circuit.calculateWitness(input, true);

            await circuit.checkConstraints(witness);
            await circuit.assertOut(witness, {
                a_square: K.mul(input.a, input.a),
            });
        }
    });

    it("Should check Fp5 subtraction", async () => {
        circuit = await wasm_tester(path.join(base_dir, "sub.test.circom"), {
            prime: "goldilocks",
        });

        for (let i = 0; i < 256; i++) {
            const input = {
                a: K.random(),
                b: K.random(),
            };

            const witness = await circuit.calculateWitness(input, true);

            await circuit.checkConstraints(witness);
            await circuit.assertOut(witness, {
                a_sub_b: K.sub(input.a, input.b),
            });
        }
    });
});
