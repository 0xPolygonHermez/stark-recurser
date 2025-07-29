const BigArray = require("@iden3/bigarray");

module.exports = function r1cs2plonk(r1cs, logger ) {
    const plonkConstraints = new BigArray();
    const plonkAdditions = new BigArray();
    let plonkNVars = r1cs.nVars;

    function join(lc1, k, lc2) {
        const res = {};
        for (let s in lc1) {
            if (typeof res[s] == "undefined") {
                res[s] = (k * lc1[s]) % 0xFFFFFFFF00000001n;
            } else {
                res[s] = (res[s] + (k * lc1[s])) % 0xFFFFFFFF00000001n;
            }
        }
        for (let s in lc2) {
            if (typeof res[s] == "undefined") {
                res[s] = lc2[s];
            } else {
                res[s] = (res[s] + lc2[s]) % 0xFFFFFFFF00000001n;
            }
        }
        normalize(res);
        return res;
    }

    function normalize(lc) {
        const ss = Object.keys(lc);
        for (let i=0; i< ss.length; i++) {
            if (lc[ss[i]] == 0n) delete lc[ss[i]];
        }
    }

    function reduceCoefs(lc, maxC) {
        const res = {
            k: 0n,
            s: [],
            coefs: []
        }
        const cs = [];
        for (let s in lc) {
            if (s==0) {
                res.k = (res.k + lc[s]) % 0xFFFFFFFF00000001n;
            } else if (lc[s] != 0n) {
                cs.push([Number(s), lc[s]])
            }
        }
        while (cs.length>maxC) {
            const c1 = cs.shift();
            const c2 = cs.shift();

            const sl = c1[0];
            const sr = c2[0];
            const so = plonkNVars++;
            const qm = 0n;
            const ql = (0xFFFFFFFF00000001n - c1[1]) % 0xFFFFFFFF00000001n;
            const qr = (0xFFFFFFFF00000001n - c2[1]) % 0xFFFFFFFF00000001n;
            const qo = 1n;
            const qc = 0n;

            plonkConstraints.push([sl, sr, so, qm, ql, qr, qo, qc]);

            plonkAdditions.push([sl, sr, c1[1], c2[1]]);

            cs.push([so, 1n]);
        }
        for (let i=0; i<cs.length; i++) {
            res.s[i] = cs[i][0];
            res.coefs[i] = cs[i][1];
        }
        while (res.coefs.length < maxC) {
            res.s.push(0);
            res.coefs.push(0n);
        }
        return res;
    }

    function addConstraintSum(lc) {
        const C = reduceCoefs(lc, 3);
        const sl = C.s[0];
        const sr = C.s[1];
        const so = C.s[2];
        const qm = 0n;
        const ql = C.coefs[0];
        const qr = C.coefs[1];
        const qo = C.coefs[2];
        const qc = C.k;
        plonkConstraints.push([sl, sr, so, qm, ql, qr, qo, qc]);
    }

    function addConstraintMul(lcA, lcB, lcC) {
        const A = reduceCoefs(lcA, 1);
        const B = reduceCoefs(lcB, 1);
        const C = reduceCoefs(lcC, 1);


        const sl = A.s[0];
        const sr = B.s[0];
        const so = C.s[0];
        const qm = (A.coefs[0] * B.coefs[0]) % 0xFFFFFFFF00000001n;
        const ql = (A.coefs[0] * B.k) % 0xFFFFFFFF00000001n;
        const qr = (A.k * B.coefs[0]) % 0xFFFFFFFF00000001n;
        const qo = (0xFFFFFFFF00000001n - C.coefs[0]) % 0xFFFFFFFF00000001n;
        const qc = ((A.k * B.k) - C.k) % 0xFFFFFFFF00000001n;
        plonkConstraints.push([sl, sr, so, qm, ql, qr, qo, qc]);
    }

    function getLCType(lc) {
        let k = 0n;
        let n = 0;
        const ss = Object.keys(lc);
        for (let i=0; i< ss.length; i++) {
            if (lc[ss[i]] == 0n) {
                delete lc[ss[i]];
            } else if (ss[i] == 0) {
                k = (k + lc[ss[i]]) % 0xFFFFFFFF00000001n;
            } else {
                n++;
            }
        }
        if (n>0) return n.toString();
        if (k != 0n) return "k";
        return "0";
    }

    function process(lcA, lcB, lcC) {
        const lctA = getLCType(lcA);
        const lctB = getLCType(lcB);
        if ((lctA == "0") || (lctB == "0")) {
            normalize(lcC);
            addConstraintSum(lcC);
        } else if (lctA == "k") {
            const lcCC = join(lcB, lcA[0], lcC);
            addConstraintSum(lcCC);
        } else if (lctB == "k") {
            const lcCC = join(lcA, lcB[0], lcC);
            addConstraintSum(lcCC);
        } else {
            addConstraintMul(lcA, lcB, lcC);
        }
    }

    for (let c=0; c<r1cs.constraints.length; c++) {
        if ((logger)&&(c%100000 == 0)) logger.debug(`Processing constraints: ${c}/${r1cs.nConstraints}`);
        process(...r1cs.constraints[c]);
    }


    return [plonkConstraints, plonkAdditions];

}
