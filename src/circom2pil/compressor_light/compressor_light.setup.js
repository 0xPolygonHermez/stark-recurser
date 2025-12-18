const { assert } = require("chai");
const fs = require("fs");
const path = require("path");
const ejs = require("ejs");
const { connect, log2, getKs, GOLDILOCKS_GEN, GOLDILOCKS_P } = require("../../utils/utils.js");
const { r1cs2plonk, getCustomGatesInfo } = require("../r1cs2plonk.js");

function calculatePlonkConstraintsRows(plonkConstraints, twoExtraConstraints) {
    let partialRows = {};
    let halfRows = [];
    let r = 0;

    let constraintsPlonkRows = 0;
    for (let i=0; i<plonkConstraints.length; i++) {
        if ((i%10000) == 0) {
            console.log(`Point Check -> Plonk info constraint processing... ${i}/${plonkConstraints.length}`);
        }
        //Each plonkConstraint has the following form: [a,b,c, qM, qL, qR, qO, qC]
        const c = plonkConstraints[i]; 
        const k= c.slice(3, 8).map( a=> a.toString(16)).join(","); //Calculate
        if(partialRows[k]) {
            constraintsPlonkRows++;
            ++partialRows[k].nUsed;
            if(partialRows[k].nUsed == partialRows[k].maxUsed) {
                delete partialRows[k];
            }
        } else if(halfRows.length > 0) {
            partialRows[k] = halfRows.shift();
            partialRows[k].nUsed++;
            constraintsPlonkRows++;
        } else if(twoExtraConstraints > 0) {
            --twoExtraConstraints;
            partialRows[k] = {nUsed: 1, custom: true, maxUsed: 2};
            constraintsPlonkRows++;
        } else {
            partialRows[k] = {nUsed: 1, custom: false, maxUsed: 7};
            constraintsPlonkRows++;
            r++;
        }
    };

    console.log(`Number of totalplonk constraints: ${plonkConstraints.length}`); 
    console.log(`Number of Plonk constraints stored in rows -> ${constraintsPlonkRows} in ${r} rows`);

    return r;
};

function getNumberConstraints(r1cs) {
    // Calculate the number plonk Additions and plonk constraints from the R1CS
    const [plonkConstraints, plonkAdditions] = r1cs2plonk(r1cs);

    console.log(`Number of plonk constraints: ${plonkConstraints.length}`);

    // Get information about the custom gates from the R1CS
    const customGatesInfo = getCustomGatesInfo(r1cs);
    
    let nCMulRows = Math.ceil(customGatesInfo.nCMul/2);
    let nPoseidon12Rows = customGatesInfo.nPoseidon12*14;
    let nCustPoseidon12Rows = customGatesInfo.nCustPoseidon12*14;
    let nTotalPoseidon12Rows = nPoseidon12Rows + nCustPoseidon12Rows;
    let nFFT4Rows = 2*customGatesInfo.nFFT4;
    let nEvPol4Rows = customGatesInfo.nEvPol4;
    let nTreeSelector4Rows = customGatesInfo.nTreeSelector4;
    let nSelectVal1Rows = customGatesInfo.nSelectVal1;
    
    // Calculate how many groups of two plonk constraints can be made 
    const CPlonkConstraints = calculatePlonkConstraintsRows(plonkConstraints, 12*(customGatesInfo.nPoseidon12 + customGatesInfo.nCustPoseidon12));

    customGatesInfo.nPlonkRows = CPlonkConstraints;

    let NUsed = CPlonkConstraints + nCMulRows + nTotalPoseidon12Rows + nFFT4Rows + nEvPol4Rows + nTreeSelector4Rows + nSelectVal1Rows;
    

    console.log(`Number of CMul: ${customGatesInfo.nCMul} -> Constraints: ${nCMulRows}`);
    console.log(`Number of Poseidon2 sponge: ${customGatesInfo.nPoseidon12} -> Constraints: ${nPoseidon12Rows}`);
    console.log(`Number of Poseidon2 compressor: ${customGatesInfo.nCustPoseidon12} -> Constraints: ${nCustPoseidon12Rows}`)
    console.log(`Total Number of Poseidon:  ${customGatesInfo.nPoseidon12 + customGatesInfo.nCustPoseidon12} -> Constraints ${nTotalPoseidon12Rows}`);
    console.log(`Number of FFT4: ${customGatesInfo.nFFT4} -> Constraints: ${nFFT4Rows}`);
    console.log(`Number of EvPol4: ${customGatesInfo.nEvPol4} -> Constraints: ${nEvPol4Rows}`);
    console.log(`Number of TreeSelector4: ${customGatesInfo.nTreeSelector4} -> Constraints: ${nTreeSelector4Rows}`);
    console.log(`Number of SelectVal1: ${customGatesInfo.nSelectVal1} -> Constraints: ${nSelectVal1Rows}`);

    return {plonkConstraints, plonkAdditions, customGatesInfo, NUsed};
}

/*
    Compress plonk constraints and verifies custom gates using 21 committed polynomials
*/
module.exports.lightCompressor = function lightCompressor(r1cs, options) {
    const committedPols = 22;

    const {plonkAdditions, plonkConstraints, customGatesInfo, NUsed} = getNumberConstraints(r1cs);

    //Calculate the first power of 2 that's bigger than the number of constraints
    let nBits = log2(NUsed - 1) + 1;

    // Calculate the total number of publics used in PIL and how many rows are needed to store all of them (remember that each row can store up to 12 values)
    let nPublics = r1cs.nOutputs + r1cs.nPubInputs;
    
    const N = 1 << nBits; // First power of 2 whose value is higher than the number of constraints

    console.log(`NUsed: ${NUsed}`);
    console.log(`nBits: ${nBits}, 2^nBits: ${N}`);
    
    const template = fs.readFileSync(path.join(__dirname, "../pil/compressor.pil2.ejs"), "utf8");
    const airGroupName = options.airgroupName || `Compressor${Math.random().toString(16).slice(2)}`;
    const obj = {
        namespaceName: airGroupName,
        templateName: "CompressorLight",
        templateFile: "compressor_light",
        nBits,
        nPublics,
        maxConstraintDegree: options.maxConstraintDegree || 8,
        nPoseidonCompressor: customGatesInfo.nCustPoseidon12,
        nPoseidonSponge: customGatesInfo.nPoseidon12,
        nCMulRows: Math.ceil(customGatesInfo.nCMul/2),
        nPlonkRows: customGatesInfo.nPlonkRows,
        nFFT4: customGatesInfo.nFFT4,
        nEvPol4: customGatesInfo.nEvPol4,
        nTreeSelector4: customGatesInfo.nTreeSelector4,
        nSelectVal1: customGatesInfo.nSelectVal1,
    };

    let pilStr = ejs.render(template ,  obj);
    
    // Stores the positions of all the values that each of the committed polynomials takes in each row 
    // Remember that there are 36 committed polynomials and the number of rows is stored in NUsed
    const sMap = [];
    for (let i=0;i<committedPols; i++) {
        sMap[i] = new Uint32Array(N).fill(0);
    }

    const C = [];
    for (let i = 0; i < 16; ++i) {
        C[i] = {
            name: `${airGroupName}.C`,
            lengths: [i],
            values: new BigUint64Array(N),
        }
    }

    const twoExtraConstraints = [];

    let r = 0;

    let poseidonGateUses = r1cs.customGatesUses.filter(cgu => cgu.id == customGatesInfo.Poseidon12Id);
    let poseidonCustGateUses = r1cs.customGatesUses.filter(cgu => cgu.id == customGatesInfo.CustPoseidon12Id);
    let cmulGateUses = r1cs.customGatesUses.filter(cgu => cgu.id == customGatesInfo.CMulId);
    let fft4GateUses = r1cs.customGatesUses.filter(cgu => typeof customGatesInfo.FFT4Parameters[cgu.id] !== "undefined");
    let evPol4GateUses = r1cs.customGatesUses.filter(cgu => cgu.id == customGatesInfo.EvPol4Id);
    let treeSelector4GateUses = r1cs.customGatesUses.filter(cgu => cgu.id == customGatesInfo.TreeSelector4Id);
    let selectVal1GateUses = r1cs.customGatesUses.filter(cgu => cgu.id == customGatesInfo.SelectVal1Id);


    // Generate Custom Gate

    console.log(`Point check -> Processing ${poseidonGateUses.length} poseidon gates...`);
    for (let i=0; i<poseidonGateUses.length; i++) {
        const cgu = poseidonGateUses[i];
        assert(cgu.signals.length == 14*16);
        let input = cgu.signals.slice(0, 16);
        let round0 = cgu.signals.slice(16, 32);
        let round1 = cgu.signals.slice(32, 48);
        let round2 = cgu.signals.slice(48, 64);
        let round3 = cgu.signals.slice(64, 80);
        let round4 = cgu.signals.slice(80, 96);
        let im1 = cgu.signals.slice(96, 112);
        let round15 = cgu.signals.slice(112, 128);
        let im2 = cgu.signals.slice(128, 144);
        let round26 = cgu.signals.slice(144, 160);
        let round27 = cgu.signals.slice(160, 176);
        let round28 = cgu.signals.slice(176, 192);
        let round29 = cgu.signals.slice(192, 208);
        let output = cgu.signals.slice(208, 224);

        for (let k = 0; k < 16; k++) {
            sMap[k][r] = input[k];
            sMap[k][r + 1] = round0[k];
            sMap[k][r + 2] = round1[k];
            sMap[k][r + 3] = round2[k];
            sMap[k][r + 4] = round3[k];
            sMap[k][r + 5] = round4[k];
            sMap[k][r + 7] = round15[k];
            sMap[k][r + 9] = round26[k];
            sMap[k][r + 10] = round27[k];
            sMap[k][r + 11] = round28[k];
            sMap[k][r + 12] = round29[k];
            sMap[k][r + 13] = output[k];
        }

        for (let k = 0; k < 11; k++) {
            sMap[k][r + 6] = im1[k];
            sMap[k][r + 8] = im2[k];
        }

        twoExtraConstraints.push(r+1);
        twoExtraConstraints.push(r+2);
        twoExtraConstraints.push(r+3);
        twoExtraConstraints.push(r+4);
        twoExtraConstraints.push(r+5);
        twoExtraConstraints.push(r+6);
        twoExtraConstraints.push(r+7);
        twoExtraConstraints.push(r+8);
        twoExtraConstraints.push(r+9);
        twoExtraConstraints.push(r+10);
        twoExtraConstraints.push(r+11);
        twoExtraConstraints.push(r+12);
                
        r+=14;
    }

    assert(r == 14*poseidonGateUses.length);
    
    console.log(`Point check -> Processing ${poseidonCustGateUses.length} poseidon custom gates...`);
    for (let i=0; i<poseidonCustGateUses.length; i++) {
        const cgu = poseidonCustGateUses[i];
        assert(cgu.signals.length == 14*16 + 2);
        let input = cgu.signals.slice(0, 16);
        let first_bit = cgu.signals[16];
        let second_bit = cgu.signals[17];
        let round0 = cgu.signals.slice(18, 34);
        let round1 = cgu.signals.slice(34, 50);
        let round2 = cgu.signals.slice(50, 66);
        let round3 = cgu.signals.slice(66, 82);
        let round4 = cgu.signals.slice(82, 98);
        let im1 = cgu.signals.slice(98, 114);
        let round15 = cgu.signals.slice(114, 130);
        let im2 = cgu.signals.slice(130, 146);
        let round26 = cgu.signals.slice(146, 162);
        let round27 = cgu.signals.slice(162, 178);
        let round28 = cgu.signals.slice(178, 194);
        let round29 = cgu.signals.slice(194, 210);
        let output = cgu.signals.slice(210, 226);
        
        for (let k = 0; k < 16; k++) {
            sMap[k][r] = input[k];
            sMap[k][r + 1] = round0[k];
            sMap[k][r + 2] = round1[k];
            sMap[k][r + 3] = round2[k];
            sMap[k][r + 4] = round3[k];
            sMap[k][r + 5] = round4[k];
            sMap[k][r + 7] = round15[k];
            sMap[k][r + 9] = round26[k];
            sMap[k][r + 10] = round27[k];
            sMap[k][r + 11] = round28[k];
            sMap[k][r + 12] = round29[k];
            sMap[k][r + 13] = output[k];
        }
        
        sMap[16][r] = first_bit;
        sMap[17][r] = second_bit;
        for (let k = 0; k < 11; k++) {
            sMap[k][r + 6] = im1[k];
            sMap[k][r + 8] = im2[k];
        }

        twoExtraConstraints.push(r+1);
        twoExtraConstraints.push(r+2);
        twoExtraConstraints.push(r+3);
        twoExtraConstraints.push(r+4);
        twoExtraConstraints.push(r+5);
        twoExtraConstraints.push(r+6);
        twoExtraConstraints.push(r+7);
        twoExtraConstraints.push(r+8);
        twoExtraConstraints.push(r+9);
        twoExtraConstraints.push(r+10);
        twoExtraConstraints.push(r+11);
        twoExtraConstraints.push(r+12);

        r+=14;
    }

    assert(r == 14*poseidonGateUses.length + 14*poseidonCustGateUses.length);
    console.log(`Point check -> Processing ${cmulGateUses.length} cmul gates...`);
    let partialRowsCMul = {row: -1, nUsed: 0};
    for (let i=0; i<cmulGateUses.length; i++) {
        const cgu = cmulGateUses[i];
        assert(cgu.signals.length === 9);
        if(partialRowsCMul.row !== -1) {
            for (let i=0; i<9; i++) {
                sMap[i + 9*partialRowsCMul.nUsed][partialRowsCMul.row] = cgu.signals[i];
            }
            partialRowsCMul.nUsed++;
            if(partialRowsCMul.nUsed === 2) {
                partialRowsCMul = {row: -1, nUsed: 0};
            }
        } else {
            for (let i=0; i<9; i++) {
                sMap[i][r] = cgu.signals[i];
            }
            
            for (let k=0; k<5; k++) {
                C[k].values[r] = 0n;
            }
            partialRowsCMul = {row: r, nUsed: 1};
            r += 1;
        }
    }

    assert(r == 14*poseidonGateUses.length + 14*poseidonCustGateUses.length + obj.nCMulRows);
    console.log(`Point check -> Processing ${evPol4GateUses.length} evPol4 gates...`);
    for (let i=0; i<evPol4GateUses.length; i++) {
        const cgu = evPol4GateUses[i];
        for (let i=0; i<21; i++) {
            sMap[i][r] = cgu.signals[i];
        }
    
        for (let k=0; k<5; k++) {
            C[k].values[r] = 0n;
        }

        r+= 1;
    }

    assert(r == 14*poseidonGateUses.length + 14*poseidonCustGateUses.length + obj.nCMulRows + evPol4GateUses.length);
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
            C[0].values[r+1] = (scale * firstW * firstW2 * incW) % GOLDILOCKS_P;
            C[1].values[r+1] = 0n;
            C[2].values[r+1] = 0n;
            C[3].values[r+1] = 0n;
        } else if (type == 2n) {
            C[0].values[r] = 0n;
            C[1].values[r] = 0n;
            C[2].values[r] = 0n;
            C[3].values[r] = 0n;
            C[4].values[r] = 0n;
            C[0].values[r+1] = 0n;
            C[1].values[r+1] = scale;
            C[2].values[r+1] = (scale * firstW) % GOLDILOCKS_P;
            C[3].values[r+1] = (scale * firstW * incW) % GOLDILOCKS_P;
        } else {
            throw new Error("Invalid FFT4 type: "+cgu.parameters[0]);
        }

        r += 2;
    }

    assert(r == 14*poseidonGateUses.length + 14*poseidonCustGateUses.length + obj.nCMulRows + 2*fft4GateUses.length + evPol4GateUses.length);
    console.log(`Point check -> Processing ${treeSelector4GateUses.length} treeSelector4 gates...`);
    for (let i=0; i<treeSelector4GateUses.length; i++) {
        const cgu = treeSelector4GateUses[i];
        assert(cgu.signals.length === 17);
        for (let i=0; i<17; i++) {
            sMap[i][r] = cgu.signals[i];
        }

        for (let k=0; k<5; k++) {
            C[k].values[r] = 0n;
        }
        r += 1;
    }

    assert(r == 14*poseidonGateUses.length + 14*poseidonCustGateUses.length + obj.nCMulRows + 2*fft4GateUses.length + evPol4GateUses.length + treeSelector4GateUses.length);

    console.log(`Point check -> Processing ${selectVal1GateUses.length} selectVal1 gates...`);
    for (let i=0; i<selectVal1GateUses.length; i++) {
        const cgu = selectVal1GateUses[i];
        assert(cgu.signals.length === 22);
        for (let i=0; i<22; i++) {
            sMap[i][r] = cgu.signals[i];
        }

        for (let k=0; k<5; k++) {
            C[k].values[r] = 0n;
        }
        r += 1;
    }

    assert(r == 14*poseidonGateUses.length + 14*poseidonCustGateUses.length + obj.nCMulRows + 2*fft4GateUses.length + evPol4GateUses.length + treeSelector4GateUses.length + selectVal1GateUses.length);

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
            sMap[pr.offset + pr.nUsed*3][pr.row] = c[0];
            sMap[pr.offset + pr.nUsed*3 + 1][pr.row] = c[1];
            sMap[pr.offset + pr.nUsed*3 + 2][pr.row] = c[2];           
            pr.nUsed++;
            if(pr.nUsed === pr.maxUsed) {
                delete partialRows[k];
            }
        } else if(twoExtraConstraints.length > 0) {
            const row = twoExtraConstraints.shift();
            C[0].values[row] = c[3];
            C[1].values[row] = c[4];
            C[2].values[row] = c[5];
            C[3].values[row] = c[6];
            C[4].values[row] = c[7];

            for (let i = 0; i < 2; ++i) {
                sMap[16 + 3*i][row] = c[0];
                sMap[16 + 3*i + 1][row] = c[1];
                sMap[16 + 3*i + 2][row] = c[2];
            }

            partialRows[k] = {
                row,
                offset: 16,
                nUsed: 1,
                custom: true,
                maxUsed: 2,
            };
        } else {
            C[0].values[r] = c[3];
            C[1].values[r] = c[4];
            C[2].values[r] = c[5];
            C[3].values[r] = c[6];
            C[4].values[r] = c[7];

            for (let i = 0; i < 7; ++i) {
                sMap[3*i][r] = c[0];
                sMap[3*i + 1][r] = c[1];
                sMap[3*i + 2][r] = c[2];
            }
            
            // Add the partial row
            partialRows[k] = {
                row: r,
                offset: 0,
                nUsed: 1,
                custom: false,
                maxUsed: 7,
            };

            r++;
        }
    }

    assert(r == NUsed, `Number of rows used in plonk constraints (${r}) does not match the expected number of rows (${NUsed})`);

    const nColsConnections = 22;

    const S = [];
    for (let i = 0; i < nColsConnections; ++i) {
        S[i] = {
            name: `${airGroupName}.S`,
            lengths: [i],
            values: new BigUint64Array(N).fill(0n),
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
        for (let k=0; k<5; k++) {
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
        airgroupName: airGroupName,
        airName: airGroupName,
    };
}
