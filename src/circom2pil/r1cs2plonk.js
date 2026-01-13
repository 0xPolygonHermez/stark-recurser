const BigArray = require("@iden3/bigarray");
const { assert } = require("chai");

module.exports.r1cs2plonk = function r1cs2plonk(r1cs, logger ) {
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
            const val = (0xFFFFFFFF00000001n - lc2[s]) % 0xFFFFFFFF00000001n;
            if (typeof res[s] == "undefined") {
                res[s] = val;
            } else {
                res[s] = (res[s] + val) % 0xFFFFFFFF00000001n;
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
        const qc = ((A.k * B.k) - C.k + 0xFFFFFFFF00000001n) % 0xFFFFFFFF00000001n;
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

module.exports.getCustomGatesInfo = function getCustomGatesInfo(r1cs) {
    // Store the different types of custom gates that are being used and how many times each
    const res = {
        Poseidon12Id: 0,
        CustPoseidon12Id: 0,
        CMulAddId: 0,
        CMulId:0,
        FFT4Parameters: {},
        EvPol4Id: 0,
        TreeSelector4Id: 0,
        SelectVal1Id: 0,
        nCMulAdd: 0,
        nCMul:0,
        nPoseidon12: 0,
        nCustPoseidon12: 0,
        nFFT4: 0,
        nEvPol4: 0,
        nTreeSelector4: 0,
        nSelectVal1: 0
    }

    // Each custom gate in the r1cs has the following structure: {templateName: "Poseidon2", parameters: []}
    // Notice that none of the custom gates will have parameters except for the FFT
    // Each FFT4 needs 4 parameters: scale, firstW, firstW2 and incW that have to be defined in order to use the custom template
    // Therefore, each FFT that uses a different set of parameters will be stored as a different custom gate in the r1cs and so
    // we will have 1 custom gate for CMulAdd, Poseidon2 and EvPol4 and many for FFT4
    for (let i=0; i<r1cs.customGates.length; i++) {
        switch (r1cs.customGates[i].templateName) {
            case "CMul":
                res.CMulId =i;
                assert(r1cs.customGates[i].parameters.length == 0);
                break;
            case "Poseidon16":
                res.Poseidon12Id =i;
                break;
            case "CustPoseidon16":
                res.CustPoseidon12Id =i;
                break;
            case "EvPol4":
                res.EvPol4Id =i;
                assert(r1cs.customGates[i].parameters.length == 0);
                break;
            case "TreeSelector4":
                res.TreeSelector4Id =i;
                assert(r1cs.customGates[i].parameters.length == 0);
                break;
            case "SelectValue1":
                res.SelectVal1Id =i;
                assert(r1cs.customGates[i].parameters.length == 0);
                break;
            case "FFT4":
                res.FFT4Parameters[i] = r1cs.customGates[i].parameters; 
                break;
            default:
                throw new Error("Invalid custom gate: " + r1cs.customGates[i].templateName);
        }
    }

    // Store how many times each custom gates is used
    for (let i=0; i< r1cs.customGatesUses.length; i++) {
        if (r1cs.customGatesUses[i].id == res.CMulId) {
            res.nCMul ++;
        } else if (r1cs.customGatesUses[i].id == res.Poseidon12Id) {
            res.nPoseidon12 ++;
        } else if (r1cs.customGatesUses[i].id == res.CustPoseidon12Id) {
            res.nCustPoseidon12 ++;
        } else if (typeof res.FFT4Parameters[r1cs.customGatesUses[i].id] !== "undefined") {
            res.nFFT4 ++;
        } else if (r1cs.customGatesUses[i].id == res.EvPol4Id) {
            res.nEvPol4 ++;
        } else if (r1cs.customGatesUses[i].id == res.TreeSelector4Id) {
            res.nTreeSelector4 ++;
        } else if (r1cs.customGatesUses[i].id == res.SelectVal1Id) {
            res.nSelectVal1 ++;
        } else {
            throw new Error("Custom gate not defined" + r1cs.customGatesUses[i].id);
        }
    }

    return res;
}