const { assert } = require("chai");
const fs = require("fs");
const path = require("path");
const ejs = require("ejs");
const { getCompressorLightConstraints } = require("../compressor_constraints.js");
const { connect, log2, getKs, GOLDILOCKS_GEN, GOLDILOCKS_P } = require("../../utils/utils.js");
const { C: POSEIDON_C } = require("../../utils/hash/poseidon/poseidon2_constants.js")

/*
    Compress plonk constraints and verifies custom gates using 21 committed polynomials
*/
module.exports = async function plonkSetup(r1cs, options) {
    const committedPols = 12;

    const {plonkAdditions, plonkConstraints, customGatesInfo, NUsed} = getCompressorLightConstraints(r1cs);

    //Calculate the first power of 2 that's bigger than the number of constraints
    let nBits = log2(NUsed - 1) + 1;

    // Calculate the total number of publics used in PIL and how many rows are needed to store all of them (remember that each row can store up to 12 values)
    let nPublics = r1cs.nOutputs + r1cs.nPubInputs;
    
    const N = 1 << nBits; // First power of 2 whose value is higher than the number of constraints

    console.log(`NUsed: ${NUsed}`);
    console.log(`nBits: ${nBits}, 2^nBits: ${N}`);
    
    const template = await fs.promises.readFile(path.join(__dirname, "compressor_light.pil2.ejs"), "utf8");
    const airName = `Compressor${Math.random().toString(16).slice(2)}`;
    const obj = {
        namespaceName: airName,
        nBits,
        nPublics,
        maxConstraintDegree: options.maxConstraintDegree || 8,
        nPoseidonCompressor: customGatesInfo.nCustPoseidon12,
        nPoseidonSponge: customGatesInfo.nPoseidon12,
        nCMulRows: customGatesInfo.nCMul,
        nPlonkRows: customGatesInfo.nPlonkRows,
        nFFT4: customGatesInfo.nFFT4,
        nEvPol4: customGatesInfo.nEvPol4,
        nTreeSelector4: customGatesInfo.nTreeSelector4,
    };

    let pilStr = ejs.render(template ,  obj);
    
    // Stores the positions of all the values that each of the committed polynomials takes in each row 
    // Remember that there are 36 committed polynomials and the number of rows is stored in NUsed
    const sMap = [];
    for (let i=0;i<committedPols; i++) {
        sMap[i] = new Uint32Array(N).fill(0);
    }

    const C = [];
    for (let i = 0; i < 12; ++i) {
        C[i] = {
            name: `${airName}.C`,
            lengths: [i],
            values: new BigUint64Array(N),
        }
    }

    let r = 0;

    let poseidonGateUses = r1cs.customGatesUses.filter(cgu => cgu.id == customGatesInfo.Poseidon12Id);
    let poseidonCustGateUses = r1cs.customGatesUses.filter(cgu => cgu.id == customGatesInfo.CustPoseidon12Id);
    let cmulGateUses = r1cs.customGatesUses.filter(cgu => cgu.id == customGatesInfo.CMulId);
    let fft4GateUses = r1cs.customGatesUses.filter(cgu => typeof customGatesInfo.FFT4Parameters[cgu.id] !== "undefined");
    let evPol4GateUses = r1cs.customGatesUses.filter(cgu => cgu.id == customGatesInfo.EvPol4Id);
    let treeSelector4GateUses = r1cs.customGatesUses.filter(cgu => cgu.id == customGatesInfo.TreeSelector4Id);


    // Generate Custom Gate

    console.log(`Point check -> Processing ${poseidonGateUses.length} poseidon gates...`);
    for (let i=0; i<poseidonGateUses.length; i++) {
        const cgu = poseidonGateUses[i];
        assert(cgu.signals.length == 14*16);
        let input = cgu.signals.slice(0, 12);
        let round0 = cgu.signals.slice(12, 24);
        let round1 = cgu.signals.slice(24, 36);
        let round2 = cgu.signals.slice(36, 48);
        let round3 = cgu.signals.slice(48, 60);
        let round4 = cgu.signals.slice(60, 72);
        let im1 = cgu.signals.slice(72, 84);
        let round15 = cgu.signals.slice(84, 96);
        let im2 = cgu.signals.slice(96, 108);
        let round26 = cgu.signals.slice(108, 120);
        let round27 = cgu.signals.slice(120, 132);
        let round28 = cgu.signals.slice(132, 144);
        let round29 = cgu.signals.slice(144, 156);
        let output = cgu.signals.slice(156, 168);

        for (let k = 0; k < 12; k++) {
            sMap[k][r] = input[k];
            sMap[k][r + 1] = round0[k];
            C[k].values[r + 1] = POSEIDON_C[k];
            sMap[k][r + 2] = round1[k];
            C[k].values[r + 2] = POSEIDON_C[12 + k];
            sMap[k][r + 3] = round2[k];
            C[k].values[r + 3] = POSEIDON_C[24 + k];
            sMap[k][r + 4] = round3[k];
            C[k].values[r + 4] = POSEIDON_C[36 + k];
            sMap[k][r + 5] = round4[k];
            sMap[k][r + 7] = round15[k];
            sMap[k][r + 9] = round26[k];
            C[k].values[r + 9] = POSEIDON_C[70 + k];
            sMap[k][r + 10] = round27[k];
            C[k].values[r + 10] = POSEIDON_C[82 + k];
            sMap[k][r + 11] = round28[k];
            C[k].values[r + 11] = POSEIDON_C[94 + k];
            sMap[k][r + 12] = round29[k];
            C[k].values[r + 12] = POSEIDON_C[106 + k];
            sMap[k][r + 13] = output[k];
        }

        for (let k = 0; k < 11; k++) {
            sMap[k][r + 6] = im1[k];
            C[k].values[r + 6] = POSEIDON_C[48 + k];
            sMap[k][r + 8] = im2[k];
            C[k].values[r + 8] = POSEIDON_C[59 + k];
        }
                
        r+=14;
    }

    assert(r == 14*poseidonGateUses.length);
    
    console.log(`Point check -> Processing ${poseidonCustGateUses.length} poseidon custom gates...`);
    for (let i=0; i<poseidonCustGateUses.length; i++) {
        const cgu = poseidonCustGateUses[i];
        assert(cgu.signals.length == 14*16 + 2);
        let input = cgu.signals.slice(0, 12);
        let first_bit = cgu.signals[12];
        let second_bit = cgu.signals[13];
        let round0 = cgu.signals.slice(14, 26);
        let round1 = cgu.signals.slice(26, 38);
        let round2 = cgu.signals.slice(38, 50);
        let round3 = cgu.signals.slice(50, 62);
        let round4 = cgu.signals.slice(62, 74);
        let im1 = cgu.signals.slice(74, 86);
        let round15 = cgu.signals.slice(86, 98);
        let im2 = cgu.signals.slice(98, 110);
        let round26 = cgu.signals.slice(110, 122);
        let round27 = cgu.signals.slice(122, 134);
        let round28 = cgu.signals.slice(134, 146);
        let round29 = cgu.signals.slice(146, 158);
        let output = cgu.signals.slice(158, 170);
        
        for (let k = 0; k < 12; k++) {
            sMap[k][r] = input[k];
            sMap[k][r + 1] = round0[k];
            C[k].values[r + 1] = POSEIDON_C[k];
            sMap[k][r + 2] = round1[k];
            C[k].values[r + 2] = POSEIDON_C[12 + k];
            sMap[k][r + 3] = round2[k];
            C[k].values[r + 3] = POSEIDON_C[24 + k];
            sMap[k][r + 4] = round3[k];
            C[k].values[r + 4] = POSEIDON_C[36 + k];
            sMap[k][r + 5] = round4[k];
            sMap[k][r + 7] = round15[k];
            sMap[k][r + 9] = round26[k];
            C[k].values[r + 9] = POSEIDON_C[70 + k];
            sMap[k][r + 10] = round27[k];
            C[k].values[r + 10] = POSEIDON_C[82 + k];
            sMap[k][r + 11] = round28[k];
            C[k].values[r + 11] = POSEIDON_C[94 + k];
            sMap[k][r + 12] = round29[k];
            C[k].values[r + 12] = POSEIDON_C[106 + k];
            sMap[k][r + 13] = output[k];
        }
        
        sMap[11][r + 6] = first_bit;
        sMap[11][r + 8] = second_bit;
        for (let k = 0; k < 11; k++) {
            sMap[k][r + 6] = im1[k];
            C[k].values[r + 6] = POSEIDON_C[48 + k];
            sMap[k][r + 8] = im2[k];
            C[k].values[r + 8] = POSEIDON_C[59 + k];
        }

        r+=14;
    }

    assert(r == 14*poseidonGateUses.length + 14*poseidonCustGateUses.length);
    console.log(`Point check -> Processing ${cmulGateUses.length} cmul gates...`);
    for (let i=0; i<cmulGateUses.length; i++) {
        const cgu = cmulGateUses[i];
        assert(cgu.signals.length === 9);
        for (let i=0; i<9; i++) {
            sMap[i][r] = cgu.signals[i];
        }
        
        for (let k=0; k<12; k++) {
            C[k].values[r] = 0n;
        }
        r += 1;
    }

    assert(r == 14*poseidonGateUses.length + 14*poseidonCustGateUses.length + cmulGateUses.length);
    console.log(`Point check -> Processing ${evPol4GateUses.length} evPol4 gates...`);
    for (let i=0; i<evPol4GateUses.length; i++) {
        const cgu = evPol4GateUses[i];
        for (let i=0; i<21; i++) {
            if (i === 12) r+= 1;
            sMap[i%12][r] = cgu.signals[i];
        }
    
        for (let k=0; k<12; k++) {
            C[k].values[r] = 0n;
        }

        r+= 1;
    }

    assert(r == 14*poseidonGateUses.length + 14*poseidonCustGateUses.length + cmulGateUses.length + 2*evPol4GateUses.length);
    console.log(`Point check -> Processing ${fft4GateUses.length} fft4 gates...`);
    for (let i=0; i<fft4GateUses.length; i++) {
        const cgu = fft4GateUses[i];
        for (let i=0; i<12; i++) {
            sMap[i][r] = cgu.signals[i];
            sMap[i][r + 1] = cgu.signals[i + 12];
        }

        const type = customGatesInfo.FFT4Parameters[cgu.id][3];
        const scale = customGatesInfo.FFT4Parameters[cgu.id][2];
        const firstW = customGatesInfo.FFT4Parameters[cgu.id][0];
        const firstW2 = (firstW * firstW) % GOLDILOCKS_P;
        const incW = customGatesInfo.FFT4Parameters[cgu.id][1];
        if (type == 4n) {
            C[0].values[r] = scale;
            C[1].values[r] = (scale * firstW2) % GOLDILOCKS_P;
            C[2].values[r] = (scale * firstW) % GOLDILOCKS_P;
            C[3].values[r] = (scale * firstW * firstW2) % GOLDILOCKS_P;
            C[4].values[r] = (scale * firstW * incW) % GOLDILOCKS_P;
            C[5].values[r] = (scale * firstW * firstW2 * incW) % GOLDILOCKS_P;
            C[6].values[r] = 0n;
            C[7].values[r] = 0n;
            C[8].values[r] = 0n;
            C[9].values[r] = 0n;
            C[10].values[r] = 0n;
            C[11].values[r] = 0n;
        } else if (type == 2n) {
            C[0].values[r] = 0n;
            C[1].values[r] = 0n;
            C[2].values[r] = 0n;
            C[3].values[r] = 0n;
            C[4].values[r] = 0n;
            C[5].values[r] = 0n;
            C[6].values[r] = scale;
            C[7].values[r] = (scale * firstW) % GOLDILOCKS_P;
            C[8].values[r] = (scale * firstW * incW) % GOLDILOCKS_P;
            C[9].values[r] = 0n;
            C[10].values[r] = 0n;
            C[11].values[r] = 0n;
        } else {
            throw new Error("Invalid FFT4 type: "+cgu.parameters[0]);
        }

        r += 2;
    }

    assert(r == 14*poseidonGateUses.length + 14*poseidonCustGateUses.length + cmulGateUses.length + 2*fft4GateUses.length + 2*evPol4GateUses.length);
    console.log(`Point check -> Processing ${treeSelector4GateUses.length} treeSelector4 gates...`);
    for (let i=0; i<treeSelector4GateUses.length; i++) {
        const cgu = treeSelector4GateUses[i];
        assert(cgu.signals.length === 17);
        for (let i=0; i<17; i++) {
            if (i === 12) r+= 1;
            sMap[i%12][r] = cgu.signals[i];
        }

        for (let k=0; k<12; k++) {
            C[k].values[r] = 0n;
        }
        r += 1;
    }

    assert(r == 14*poseidonGateUses.length + 14*poseidonCustGateUses.length + cmulGateUses.length + 2*fft4GateUses.length + 2*evPol4GateUses.length + 2*treeSelector4GateUses.length);

    // Paste plonk constraints. 
    // Each row can be split in three subsets: 
    // a[0], a[1], a[2] and a[3], a[4], a[5] --> C[0], C[1], C[2], C[3], C[4]
    // a[6], a[7], a[8] and a[9], a[10], a[11] --> C[6], C[7], C[8], C[9], C[10]
    // a[12], a[13], a[14] and a[15], a[16], a[17] --> C[12], C[13], C[14], C[15], C[16]
    // Remember that each row will contain two sets of constraints, each of them should be fulfilled by two different set of wires.
    const partialRows = {}; // Stores a row that is partially completed, which means that a we only have one set of wires (a_i, b_i, c_i) that fulfill a given constraint
    const halfRows = []; // Stores a row that already contains a constraint (qL, qR, qM, qO, qC) with two sets of wires that fulfill it
    for (let i=0; i<plonkConstraints.length; i++) {
        if ((i%10000) == 0) console.log(`Point check -> Processing constraint... ${i}/${plonkConstraints.length}`);
        const c = plonkConstraints[i];
        const k= c.slice(3, 8).map( a=> a.toString(16)).join(",");
        // Once a new constraint is read, check if there's some partial row with that constraint. If that's the case, add the wire (which is stored in [c0, c1, c2]) to 
        // the corresponding row
        if (partialRows[k]) {
            const pr = partialRows[k];
            sMap[pr.nUsed*3][pr.row] = c[0];
            sMap[pr.nUsed*3+1][pr.row] = c[1];
            sMap[pr.nUsed*3+2][pr.row] = c[2];           
            pr.nUsed++;
            if(pr.nUsed === 2 || pr.nUsed === 4) {
                delete partialRows[k];
            }
        // If the constraint is not stored in partialRows (which means that there is no other row that is using this very same set of constraints and is not full)
        // check if there's any half row. If that's the case, attach the new set of constraints values to that row 
        } else if (halfRows.length > 0) {
            const pr = halfRows.shift();
            C[5].values[pr.row] = c[3];
            C[6].values[pr.row] = c[4];
            C[7].values[pr.row] = c[5];
            C[8].values[pr.row] = c[6];
            C[9].values[pr.row] = c[7];

            sMap[6][pr.row] = c[0];
            sMap[7][pr.row] = c[1];
            sMap[8][pr.row] = c[2];
            sMap[9][pr.row] = c[0];
            sMap[10][pr.row] = c[1];
            sMap[11][pr.row] = c[2];
            
            pr.nUsed++;
            partialRows[k] = pr;
        } else {
            C[0].values[r] = c[3];
            C[1].values[r] = c[4];
            C[2].values[r] = c[5];
            C[3].values[r] = c[6];
            C[4].values[r] = c[7];

            sMap[0][r] = c[0];
            sMap[1][r] = c[1];
            sMap[2][r] = c[2];
            sMap[3][r] = c[0];
            sMap[4][r] = c[1];
            sMap[5][r] = c[2];
            
            // Add the partial row
            partialRows[k] = {
                row: r,
                nUsed: 1,
                custom: false,
                maxUsed: 2,
            };

            halfRows.push({
                row: r,
                nUsed: 2,
                custom: false,
                maxUsed: 4,
            });


            r++;
        }
    }

    assert(r == NUsed, `Number of rows used in plonk constraints (${r}) does not match the expected number of rows (${NUsed})`);

    const nColsConnections = 12;

    const S = [];
    for (let i = 0; i < nColsConnections; ++i) {
        S[i] = {
            name: `${airName}.S`,
            lengths: [i],
            values: new BigUint64Array(N),
        }
    }

    // Calculate S Polynomials
    const ks = getKs(nColsConnections - 1);
    let w = 1n;
    for (let i=0; i<N; i++) {
        if ((i%10000) == 0) console.log(`Point check -> Preparing S... ${i}/${N}`);
        S[0].values[i] = w;
        for (let j=1; j<nColsConnections; j++) {
            S[j].values[i] = (w * ks[j - 1]) % GOLDILOCKS_P;
        }
        w = (w * GOLDILOCKS_GEN[nBits]) % GOLDILOCKS_P;
    }

    let connections = 0;
    const lastSignal = {}
    for (let i=0; i<r; i++) {
        if ((i%10000) == 0) console.log(`Point check -> Connection S... ${i}/${r}`);
        for (let j=0; j<nColsConnections; j++) {
            if (sMap[j][i]) {
                if (typeof lastSignal[sMap[j][i]] !== "undefined") {
                    const ls = lastSignal[sMap[j][i]];
                    connections++;
                    connect(S[ls.col].values,ls.row, S[j].values,i);
                } else {
                    lastSignal[sMap[j][i]] = {
                        col: j,
                        row: i
                    };
                }
            }
        }
    }

    console.log(`Number of connections: ${connections}`);
    
    // Fill unused rows (NUsed < r < N) with empty gates
    while (r<N) {
        if ((r%100000) == 0) console.log(`Point check -> Empty gates... ${r}/${N}`);
        for (let k=0; k<12; k++) {
            C[k].values[r] = 0n;
        }
        r +=1;
    }

    const fixedPols = [...C, ...S];

    return {
        fixedPols,
        pilStr,
        nBits,
        sMap: sMap,
        plonkAdditions,
        airgroupName: airName,
        airName: airName,
    };
}
