/*
    This is a field extension 5 of the goldilocks:

    Prime: 0xFFFFFFFF00000001
    Irreducible polynomial: x^5 - 3
*/

const { F1Field } = require("ffjavascript");

const crypto = require("crypto");

module.exports = class F5g {
    constructor() {
        this.F = new F1Field(0xffffffff00000001n);
        this.p = this.F.p;
        this.q = 0xfffffffb0000000effffffe20000002cffffffcd0000002cffffffe20000000efffffffb00000001n;
        this.g = [2n, 1n, 0n, 0n, 0n];
        this.zero = this.F.zero;
        this.one = this.F.one;

        this.bitLength1 = this.F.bitLength;
    }

    e(a, b) {
        if (Array.isArray(a)) {
            return [this.e(a[0], b), this.e(a[1], b), this.e(a[2], b), this.e(a[3], b), this.e(a[4], b)];
        }
        let res;
        if (!b) {
            res = BigInt(a);
        } else if (b == 16) {
            res = BigInt("0x" + a);
        }
        if (res < 0) {
            let nres = -res;
            if (nres >= this.p) nres = nres % this.p;
            return this.p - nres;
        } else {
            return res >= this.p ? res % this.p : res;
        }
    }

    add(a, b) {
        if (typeof a == "bigint") {
            if (typeof b == "bigint") {
                return (a + b) % this.p;
            } else {
                return [(a + b[0]) % this.p, b[1], b[2], b[3], b[4]];
            }
        } else if (typeof b == "bigint") {
            return [(a[0] + b) % this.p, a[1], a[2], a[3], a[4]];
        } else {
            return [
                (a[0] + b[0]) % this.p,
                (a[1] + b[1]) % this.p,
                (a[2] + b[2]) % this.p,
                (a[3] + b[3]) % this.p,
                (a[4] + b[4]) % this.p,
            ];
        }
    }

    sub(a, b) {
        if (typeof a == "bigint") {
            if (typeof b == "bigint") {
                return a >= b ? a - b : this.p - b + a;
            } else {
                return [
                    a >= b[0] ? a - b[0] : this.p - b[0] + a,
                    b[1] > 0n ? this.p - b[1] : b[1],
                    b[2] > 0n ? this.p - b[2] : b[2],
                    b[3] > 0n ? this.p - b[3] : b[3],
                    b[4] > 0n ? this.p - b[4] : b[4],
                ];
            }
        } else if (typeof b == "bigint") {
            return [
                a[0] >= b ? a[0] - b : this.p - b + a[0],
                a[1],
                a[2],
                a[3],
                a[4],
            ];
        } else {
            return [
                a[0] >= b[0] ? a[0] - b[0] : this.p - b[0] + a[0],
                a[1] >= b[1] ? a[1] - b[1] : this.p - b[1] + a[1],
                a[2] >= b[2] ? a[2] - b[2] : this.p - b[2] + a[2],
                a[3] >= b[3] ? a[3] - b[3] : this.p - b[3] + a[3],
                a[4] >= b[4] ? a[4] - b[4] : this.p - b[4] + a[4],
            ];
        }
    }

    neg(a) {
        if (typeof a == "bigint") {
            return a > 0n ? this.p - a : a;
        } else {
            return [
                a[0] > 0n ? this.p - a[0] : a[0],
                a[1] > 0n ? this.p - a[1] : a[1],
                a[2] > 0n ? this.p - a[2] : a[2],
                a[3] > 0n ? this.p - a[3] : a[3],
                a[4] > 0n ? this.p - a[4] : a[4],
            ];
        }
    }

    mul(a, b) {
        if (typeof a == "bigint") {
            if (typeof b == "bigint") {
                return (a * b) % this.p;
            } else {
                return [
                    (a * b[0]) % this.p,
                    (a * b[1]) % this.p,
                    (a * b[2]) % this.p,
                    (a * b[3]) % this.p,
                    (a * b[4]) % this.p,
                ];
            }
        } else if (typeof b == "bigint") {
            return [
                (a[0] * b) % this.p,
                (a[1] * b) % this.p,
                (a[2] * b) % this.p,
                (a[3] * b) % this.p,
                (a[4] * b) % this.p,
            ];
        } else {
            let r0 =
                a[0] * b[0] +
                3n * (a[1] * b[4] + a[2] * b[3] + a[3] * b[2] + a[4] * b[1]);
            let r1 =
                a[0] * b[1] +
                a[1] * b[0] +
                3n * (a[2] * b[4] + a[3] * b[3] + a[4] * b[2]);
            let r2 =
                a[0] * b[2] +
                a[1] * b[1] +
                a[2] * b[0] +
                3n * (a[3] * b[4] + a[4] * b[3]);
            let r3 =
                a[0] * b[3] +
                a[1] * b[2] +
                a[2] * b[1] +
                a[3] * b[0] +
                3n * (a[4] * b[4]);
            let r4 =
                a[0] * b[4] +
                a[1] * b[3] +
                a[2] * b[2] +
                a[3] * b[1] +
                a[4] * b[0];

            return [
                r0 % this.p,
                r1 % this.p,
                r2 % this.p,
                r3 % this.p,
                r4 % this.p,
            ];
        }
    }

    mulScalar(a, b) {
        b = BigInt(b);
        if (typeof a == "bigint") {
            return (a * b) % this.p;
        } else {
            return [
                (a[0] * b) % this.p,
                (a[1] * b) % this.p,
                (a[2] * b) % this.p,
                (a[3] * b) % this.p,
                (a[4] * b) % this.p,
            ];
        }
    }

    square(a) {
        if (typeof a == "bigint") {
            return (a * a) % this.p;
        } else {
            let r0 = a[0] * a[0] + 6n * (a[1] * a[4] + a[2] * a[3]);
            let r1 = 2n * a[0] * a[1] + 3n * (a[3] * a[3] + 2n * a[2] * a[4]);
            let r2 = a[1] * a[1] + 2n * a[0] * a[2] + 6n * a[3] * a[4];
            let r3 = 2n * (a[0] * a[3] + a[1] * a[2]) + 3n * a[4] * a[4];
            let r4 = a[2] * a[2] + 2n * (a[0] * a[4] + a[1] * a[3]);

            return [
                r0 % this.p,
                r1 % this.p,
                r2 % this.p,
                r3 % this.p,
                r4 % this.p,
            ];
        }
    }

    eq(a, b) {
        if (typeof a == "bigint") {
            if (typeof b == "bigint") {
                return a == b;
            } else {
                return a == b[0] && b[1] == 0 && b[2] == 0 && b[3] == 0 && b[4] == 0;
            }
        } else if (typeof b == "bigint") {
            return a[0] == b && a[1] == 0 && a[2] == 0 && a[3] == 0 && a[4] == 0;
        } else {
            return a[0] == b[0] && a[1] == b[1] && a[2] == b[2] && a[3] == b[3] && a[4] == b[4];
        }
    }

    gt(a, b) {
        const self = this;
        a = norm(a);
        b = norm(b);
        if (typeof a == "bigint") {
            if (typeof b == "bigint") {
                return a > b;
            } else {
                return a > b[0];
            }
        } else if (typeof b == "bigint") {
            return (
                a[0] > b ||
                (a[0] == b && a[1] > 0n) ||
                (a[0] == b && a[1] == 0n && a[2] > 0n) ||
                (a[0] == b && a[1] == 0n && a[2] == 0n && a[3] > 0n) ||
                (a[0] == b && a[1] == 0n && a[2] == 0n && a[3] == 0n && a[4] > 0n)
            );
        } else {
            return (
                a[0] > b[0] ||
                (a[0] == b[0] && a[1] > b[1]) ||
                (a[0] == b[0] && a[1] == b[1] && a[2] > b[2]) ||
                (a[0] == b[0] && a[1] == b[1] && a[2] == b[2] && a[3] > b[3]) ||
                (a[0] == b[0] && a[1] == b[1] && a[2] == b[2] && a[3] == b[3] && a[4] > b[4])
            );
        }

        function norm(a) {
            if (typeof a == "bigint") {
                return [norm1(a), 0n, 0n];
            } else {
                return [norm1(a[0]), norm1(a[1]), norm1(a[2]), norm1(a[3]), norm1(a[4])];
            }
        }

        function norm1(a) {
            return a > self.half ? a - self.p : a;
        }
    }

    geq(a, b) {
        return this.gt(a, b) || this.eq(a, b);
    }

    lt(a, b) {
        return !this.geq(a, b);
    }

    leq(a, b) {
        return !this.gt(a, b);
    }

    neq(a, b) {
        return !this.eq(a, b);
    }

    isZero(a) {
        if (typeof a == "bigint") {
            return a == 0n;
        } else {
            return a[0] == 0n && a[1] == 0n && a[2] == 0n && a[3] == 0n && a[4] == 0n;
        }
    }

    exp(base, e) {
        e = BigInt(e);
        if (e === 0n) return this.one;

        const n = this._bits(e);

        if (n.length == 0) return this.one;

        let res = base;

        for (let i = n.length - 2; i >= 0; i--) {
            res = this.square(res);

            if (n[i]) {
                res = this.mul(res, base);
            }
        }

        return res;
    }

    pow(base, e) {
        return this.exp(base, e);
    }

    toString(a, base) {
        base = base || 10;
        if (typeof a == "bigint") {
            return a.toString(base);
        } else {
            return [
                this.toString(a[0], base),
                this.toString(a[1], base),
                this.toString(a[2], base),
                this.toString(a[3], base),
                this.toString(a[4], base),
            ];
        }
    }

    _bits(n) {
        let E = BigInt(n);
        const res = [];
        while (E) {
            if (E & 1n) {
                res.push(1);
            } else {
                res.push(0);
            }
            E = E >> 1n;
        }
        return res;
    }

    random() {
        return [this._random1(), this._random1(), this._random1(), this._random1(), this._random1()];
    }

    _random1() {
        const nBytes = (this.bitLength1 * 2) / 8;
        let res = this.zero;
        for (let i = 0; i < nBytes; i++) {
            res = (res << BigInt(8)) + BigInt(this._getRandomBytes(1)[0]);
        }
        return res % this.p;
    }

    _getRandomBytes(n) {
        let array = new Uint8Array(n);
        if (process.browser) {
            // Browser
            if (typeof globalThis.crypto !== "undefined") {
                // Supported
                globalThis.crypto.getRandomValues(array);
            } else {
                // fallback
                for (let i = 0; i < n; i++) {
                    array[i] = (Math.random() * 4294967296) >>> 0;
                }
            }
        } else {
            // NodeJS
            crypto.randomFillSync(array);
        }
        return array;
    }
};
