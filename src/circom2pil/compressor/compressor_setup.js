const { assert } = require("chai");
const fs = require("fs");
const path = require("path");
const {tmpName} = require("tmp-promise");
const ejs = require("ejs");
const { getCompressorConstraints } = require("../compressor_constraints.js");
const { connect, log2, getKs, GOLDILOCKS_GEN, GOLDILOCKS_P } = require("../../utils/utils.js");
const { generateFixedCols } = require("../../utils/witnessCalculator.js");
const compilePil2 = require("pil2-compiler/src/compiler.js");
const protobuf = require('protobufjs');
const { exit } = require("process");
const { getFixedPolsPil2 } = require("../../../../pil2-proofman-js/src/pil2-stark/pil_info/helpers/pil2/piloutInfo.js");

/*
    Compress plonk constraints and verifies custom gates using 21 committed polynomials
*/
module.exports = async function plonkSetup(F, r1cs, options) {
    const committedPols = 36;

    const {plonkAdditions, plonkConstraints, customGatesInfo, NUsed} = getCompressorConstraints(F, r1cs, 36);

    //Calculate the first power of 2 that's bigger than the number of constraints
    let nBits = log2(NUsed - 1) + 1;

    // Calculate the total number of publics used in PIL and how many rows are needed to store all of them (remember that each row can store up to 12 values)
    let nPublics = r1cs.nOutputs + r1cs.nPubInputs;
    
    const N = 1 << nBits; // First power of 2 whose value is higher than the number of constraints

    console.log(`NUsed: ${NUsed}`);
    console.log(`nBits: ${nBits}, 2^nBits: ${N}`);
    
    const template = await fs.promises.readFile(path.join(__dirname, "compressor.pil2.ejs"), "utf8");
    const airName = `Compressor${Math.random().toString(16).slice(2)}`;
    const obj = {
        namespaceName: airName,
        nBits,
        nPublics,
        blowupFactor: options.blowupFactor || 3,
        nPoseidonCompressor: customGatesInfo.nCustPoseidon12,
        nPoseidonSponge: customGatesInfo.nPoseidon12,
        nCMulRows: Math.ceil(customGatesInfo.nCMul/2),
        nPlonkRows: customGatesInfo.nPlonkRows,
        nFFT4: customGatesInfo.nFFT4,
        nEvPol4: customGatesInfo.nEvPol4,
        nTreeSelector4: customGatesInfo.nTreeSelector4,
    };

    let pilStr = ejs.render(template ,  obj);
    const pilFile = await tmpName();
    await fs.promises.writeFile(pilFile, pilStr, "utf8");

    let piloutPath = pilFile + ".ptb";
    options.stdPath = path.join(path.resolve(__dirname), "../../../../pil2-proofman/pil2-components/lib/std/pil"); // TODO   
    let pilConfig = { outputFile: piloutPath, includePaths: [options.stdPath] };
    compilePil2(F, pilFile, null, pilConfig);
    
    const piloutEncoded = fs.readFileSync(piloutPath);
    const pilOutProtoPath = path.resolve(__dirname, '../../../node_modules/pil2-compiler/src/pilout.proto');
    const PilOut = protobuf.loadSync(pilOutProtoPath).lookupType("PilOut");
    let pilout = PilOut.toObject(PilOut.decode(piloutEncoded));
    
    let fixedPols = generateFixedCols(pilout.symbols.filter(s=>s.airGroupId == 0), N);
    await getFixedPolsPil2(pilout.airGroups[0].name, pilout.airGroups[0].airs[0], fixedPols, true);

    fs.promises.unlink(pilFile);
    fs.promises.unlink(piloutPath);
    
    // Stores the positions of all the values that each of the committed polynomials takes in each row 
    // Remember that there are 36 committed polynomials and the number of rows is stored in NUsed
    const sMap = [];
    for (let i=0;i<committedPols; i++) {
        sMap[i] = new Uint32Array(N).fill(0);
    }

    const eightExtraConstraints = [];
    const fourExtraConstraints = [];
    const twoExtraConstraints = [];

    let partialRowsCMul = -1;

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
        assert(cgu.signals.length == 13*12);
        let input = cgu.signals.slice(0, 12);
        let round0 = cgu.signals.slice(12, 24);
        let round1 = cgu.signals.slice(24, 36);
        let round2 = cgu.signals.slice(36, 48);
        let round3 = cgu.signals.slice(48, 60);
        let round4 = cgu.signals.slice(60, 72);
        let im = cgu.signals.slice(72, 94);
        let round26 = cgu.signals.slice(96, 108);
        let round27 = cgu.signals.slice(108, 120);
        let round28 = cgu.signals.slice(120, 132);
        let round29 = cgu.signals.slice(132, 144);
        let output = cgu.signals.slice(144, 156);

        for (let i = 0; i < 12; i++) {
            sMap[i][r] = input[i];
            sMap[i + 12][r] = round0[i];
            sMap[i + 24][r] = round1[i];
            sMap[i + 12][r + 1] = round2[i];
            sMap[i + 24][r + 1] = round3[i];
            sMap[i + 24][r + 2] = round4[i];
            sMap[i + 12][r + 4] = round26[i];
            sMap[i + 24][r + 4] = round27[i];
            sMap[i + 12][r + 5] = round28[i];
            sMap[i + 24][r + 5] = round29[i];
            sMap[i][r + 5] = output[i];
        }

        for (let i = 0; i < 22; i++) {
            sMap[i + 14][r + 3] = im[i];
        }
        
        for (let i = 0; i < 6; ++i) {
            for (let k=0; k<10; k++) {
                fixedPols[airName].C[k][r+i] = 0n;
            }
            
            if(i == 1 || i == 3 || i == 4) {
                fourExtraConstraints.push(r+i);
            }
            if(i == 2) {
                eightExtraConstraints.push(r+i);
            }
        }
        
        r+=6;
    }

    assert(r == 6*poseidonGateUses.length);
    
    console.log(`Point check -> Processing ${poseidonCustGateUses.length} poseidon custom gates...`);
    for (let i=0; i<poseidonCustGateUses.length; i++) {
        const cgu = poseidonCustGateUses[i];
        assert(cgu.signals.length == 13*12 + 2);
        let input = cgu.signals.slice(0, 12);
        let first_bit = cgu.signals[12];
        let second_bit = cgu.signals[13];
        let round0 = cgu.signals.slice(14, 26);
        let round1 = cgu.signals.slice(26, 38);
        let round2 = cgu.signals.slice(38, 50);
        let round3 = cgu.signals.slice(50, 62);
        let round4 = cgu.signals.slice(62, 74);
        let im = cgu.signals.slice(74, 96);
        let round26 = cgu.signals.slice(98, 110);
        let round27 = cgu.signals.slice(110, 122);
        let round28 = cgu.signals.slice(122, 134);
        let round29 = cgu.signals.slice(134, 146);
        let output = cgu.signals.slice(146, 158);
        
        for (let i = 0; i < 12; i++) {
            sMap[i][r] = input[i];
            sMap[i + 12][r] = round0[i];
            sMap[i + 24][r] = round1[i];
            sMap[i + 12][r + 1] = round2[i];
            sMap[i + 24][r + 1] = round3[i];
            sMap[i + 24][r + 2] = round4[i];
            sMap[i + 12][r + 4] = round26[i];
            sMap[i + 24][r + 4] = round27[i];
            sMap[i + 12][r + 5] = round28[i];
            sMap[i + 24][r + 5] = round29[i];
            sMap[i][r + 5] = output[i];
        }
        
        sMap[12][r + 3] = first_bit;
        sMap[13][r + 3] = second_bit;
        for (let i = 0; i < 22; i++) {
            sMap[i + 14][r + 3] = im[i];
        }

        for (let i = 0; i < 6; ++i) {
            for (let k=0; k<10; k++) {
                fixedPols[airName].C[k][r+i] = 0n;
            }
            
            if(i == 1 || i == 3 || i == 4) {
                fourExtraConstraints.push(r+i);
            }
            if(i == 2) {
                eightExtraConstraints.push(r+i);
            }
        }

        r+=6;
    }

    assert(r == 6*poseidonGateUses.length + 6*poseidonCustGateUses.length);
    console.log(`Point check -> Processing ${cmulGateUses.length} cmul gates...`);
    for (let i=0; i<cmulGateUses.length; i++) {
        const cgu = cmulGateUses[i];
        assert(cgu.signals.length === 9);
        if(partialRowsCMul !== -1) {
            for (let i=0; i<9; i++) {
                sMap[i + 9][partialRowsCMul] = cgu.signals[i];
            }
            partialRowsCMul = -1;
        } else {
            for (let i=0; i<9; i++) {
                sMap[i][r] = cgu.signals[i];
            }
            
            for (let k=0; k<10; k++) {
                fixedPols[airName].C[k][r] = 0n;
            }
            partialRowsCMul = r;
            twoExtraConstraints.push(r);
            r += 1;
        }
    }

    assert(r == 6*poseidonGateUses.length + 6*poseidonCustGateUses.length + obj.nCMulRows);
    console.log(`Point check -> Processing ${evPol4GateUses.length} evPol4 gates...`);
    for (let i=0; i<evPol4GateUses.length; i++) {
        const cgu = evPol4GateUses[i];
        for (let i=0; i<21; i++) {
            sMap[i][r] = cgu.signals[i];
        }
    
        for (let k=0; k<10; k++) {
            fixedPols[airName].C[k][r] = 0n;
        }

        r+= 1;
    }

    assert(r == 6*poseidonGateUses.length + 6*poseidonCustGateUses.length + obj.nCMulRows + evPol4GateUses.length);
    console.log(`Point check -> Processing ${fft4GateUses.length} fft4 gates...`);
    for (let i=0; i<fft4GateUses.length; i++) {
        const cgu = fft4GateUses[i];
        for (let i=0; i<24; i++) {
            sMap[i][r] = cgu.signals[i];
        }

        const type = customGatesInfo.FFT4Parameters[cgu.id][3];
        const scale = customGatesInfo.FFT4Parameters[cgu.id][2];
        const firstW = customGatesInfo.FFT4Parameters[cgu.id][0];
        const firstW2 = (firstW * firstW) % GOLDILOCKS_P;
        const incW = customGatesInfo.FFT4Parameters[cgu.id][1];
        if (type == 4n) {
            fixedPols[airName].C[0][r] = scale;
            fixedPols[airName].C[1][r] = (scale * firstW2) % GOLDILOCKS_P;
            fixedPols[airName].C[2][r] = (scale * firstW) % GOLDILOCKS_P;
            fixedPols[airName].C[3][r] = (scale * firstW * firstW2) % GOLDILOCKS_P;
            fixedPols[airName].C[4][r] = (scale * firstW * incW) % GOLDILOCKS_P;
            fixedPols[airName].C[5][r] = (scale * firstW * firstW2 * incW) % GOLDILOCKS_P;
            fixedPols[airName].C[6][r] = 0n;
            fixedPols[airName].C[7][r] = 0n;
            fixedPols[airName].C[8][r] = 0n;
            fixedPols[airName].C[9][r] = 0n;
        } else if (type == 2n) {
            fixedPols[airName].C[0][r] = 0n;
            fixedPols[airName].C[1][r] = 0n;
            fixedPols[airName].C[2][r] = 0n;
            fixedPols[airName].C[3][r] = 0n;
            fixedPols[airName].C[4][r] = 0n;
            fixedPols[airName].C[5][r] = 0n;
            fixedPols[airName].C[6][r] = scale;
            fixedPols[airName].C[7][r] = (scale * firstW) % GOLDILOCKS_P;
            fixedPols[airName].C[8][r] = (scale * firstW * incW) % GOLDILOCKS_P;
            fixedPols[airName].C[9][r] = 0n;
        } else {
            throw new Error("Invalid FFT4 type: "+cgu.parameters[0]);
        }

        r += 1;
    }

    assert(r == 6*poseidonGateUses.length + 6*poseidonCustGateUses.length + obj.nCMulRows + fft4GateUses.length + evPol4GateUses.length);
    console.log(`Point check -> Processing ${treeSelector4GateUses.length} treeSelector4 gates...`);
    for (let i=0; i<treeSelector4GateUses.length; i++) {
        const cgu = treeSelector4GateUses[i];
        assert(cgu.signals.length === 17);
        for (let i=0; i<17; i++) {
            sMap[i][r] = cgu.signals[i];
        }

        for (let k=0; k<10; k++) {
            fixedPols[airName].C[k][r] = 0n;
        }
        twoExtraConstraints.push(r);
        r += 1;
    }

    assert(r == 6*poseidonGateUses.length + 6*poseidonCustGateUses.length + obj.nCMulRows + fft4GateUses.length + evPol4GateUses.length + treeSelector4GateUses.length);

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
            if(pr.nUsed === 2 || pr.nUsed === 8 || pr.nUsed === pr.maxUsed) {
                delete partialRows[k];
            }
        // If the constraint is not stored in partialRows (which means that there is no other row that is using this very same set of constraints and is not full)
        // check if there's any half row. If that's the case, attach the new set of constraints values to that row 
        } else if (halfRows.length > 0) {
            const pr = halfRows.shift();
            fixedPols[airName].C[5][pr.row] = c[3];
            fixedPols[airName].C[6][pr.row] = c[4];
            fixedPols[airName].C[7][pr.row] = c[5];
            fixedPols[airName].C[8][pr.row] = c[6];
            fixedPols[airName].C[9][pr.row] = c[7];

            for(let i = pr.nUsed; i < pr.maxUsed; ++i) {
                sMap[3*i][pr.row] = c[0];
                sMap[3*i + 1][pr.row] = c[1];
                sMap[3*i + 2][pr.row] = c[2];
            }
            
            pr.nUsed++;
            partialRows[k] = pr;
        } else if(eightExtraConstraints.length > 0) {
            const row = eightExtraConstraints.shift();
            fixedPols[airName].C[0][row] = c[3];
            fixedPols[airName].C[1][row] = c[4];
            fixedPols[airName].C[2][row] = c[5];
            fixedPols[airName].C[3][row] = c[6];
            fixedPols[airName].C[4][row] = c[7];
            
            sMap[0][row] = c[0];
            sMap[1][row] = c[1];
            sMap[2][row] = c[2];
            sMap[3][row] = c[0];
            sMap[4][row] = c[1];
            sMap[5][row] = c[2];

            partialRows[k] = {
                row,
                nUsed: 1,
                custom: true,
                maxUsed: 2,
            };

            halfRows.push({
                row,
                nUsed: 2,
                custom: true,
                maxUsed: 8,
            });
        } else if(fourExtraConstraints.length > 0) {
            const row = fourExtraConstraints.shift();
            fixedPols[airName].C[0][row] = c[3];
            fixedPols[airName].C[1][row] = c[4];
            fixedPols[airName].C[2][row] = c[5];
            fixedPols[airName].C[3][row] = c[6];
            fixedPols[airName].C[4][row] = c[7];
            
            sMap[0][row] = c[0];
            sMap[1][row] = c[1];
            sMap[2][row] = c[2];
            sMap[3][row] = c[0];
            sMap[4][row] = c[1];
            sMap[5][row] = c[2];

            partialRows[k] = {
                row,
                nUsed: 1,
                custom: true,
                maxUsed: 2,
            };
            halfRows.push({
                row,
                nUsed: 2,
                custom: true,
                maxUsed: 4,
            });
        } else if (twoExtraConstraints.length > 0) {
            const row = twoExtraConstraints.shift();
            fixedPols[airName].C[5][row] = c[3];
            fixedPols[airName].C[6][row] = c[4];
            fixedPols[airName].C[7][row] = c[5];
            fixedPols[airName].C[8][row] = c[6];
            fixedPols[airName].C[9][row] = c[7];
            
            sMap[18][row] = c[0];
            sMap[19][row] = c[1];
            sMap[20][row] = c[2];
            sMap[21][row] = c[0];
            sMap[22][row] = c[1];
            sMap[23][row] = c[2];

            partialRows[k] = {
                row,
                nUsed: 7,
                custom: true,
                maxUsed: 8,
            };
        } else {
            fixedPols[airName].C[0][r] = c[3];
            fixedPols[airName].C[1][r] = c[4];
            fixedPols[airName].C[2][r] = c[5];
            fixedPols[airName].C[3][r] = c[6];
            fixedPols[airName].C[4][r] = c[7];
            
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
                maxUsed: 8,
            });

            for(let i = 6; i < 10; ++i) {
                sMap[i][r] = 0;
                fixedPols[airName].C[i][r] = 0n;
            }

            r++;
        }
    }

    assert(r == NUsed, `Number of rows used in plonk constraints (${r}) does not match the expected number of rows (${NUsed})`);

    for (let i=0; i < N; ++i) {
        if(i < 6*poseidonGateUses.length) {
            assert(fixedPols[airName].PLONK[i] === 0n, `PLONK polynomial at row ${i} should be 0, but it is ${fixedPols[airName].PLONK[i]}`);
            if(i % 6 == 0)  {
                assert(fixedPols[airName].POSEIDONSPONGE[i] === 1n, `POSEIDONSPONGE polynomial at row ${i} should be 1, but it is ${fixedPols[airName].POSEIDONSPONGE[i]}`);
            } else {
                assert(fixedPols[airName].POSEIDONSPONGE[i] === 0n, `POSEIDONSPONGE polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDONSPONGE[i]}`);
            }
            assert(fixedPols[airName].POSEIDONCOMPRESSION[i] === 0n, `POSEIDONCOMPRESSION polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDONCOMPRESSION[i]}`);
            if(i % 6 == 5) {
                assert(fixedPols[airName].POSEIDON_FINAL[i] === 1n, `POSEIDON_FINAL polynomial at row ${i} should be 1, but it is ${fixedPols[airName].POSEIDON_FINAL[i]}`);
            } else {
                assert(fixedPols[airName].POSEIDON_FINAL[i] === 0n, `POSEIDON_FINAL polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDON_FINAL[i]}`);
            }
            if(i % 6 == 3) {
                assert(fixedPols[airName].POSEIDON_PARTIAL_ROUND[i] === 1n, `POSEIDON_PARTIAL_ROUND polynomial at row ${i} should be 1, but it is ${fixedPols[airName].POSEIDON_PARTIAL_ROUND[i]}`);
            } else {
                assert(fixedPols[airName].POSEIDON_PARTIAL_ROUND[i] === 0n, `POSEIDON_PARTIAL_ROUND polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDON_PARTIAL_ROUND[i]}`);
            }
            assert(fixedPols[airName].FFT4[i] === 0n, `FFT4 polynomial at row ${i} should be 0, but it is ${fixedPols[airName].FFT4[i]}`);
            assert(fixedPols[airName].TREESELECTOR4[i] === 0n, `TREESELECTOR4 polynomial at row ${i} should be 0, but it is ${fixedPols[airName].TREESELECTOR4[i]}`);
            assert(fixedPols[airName].EVPOL4[i] === 0n, `EVPOL4 polynomial at row ${i} should be 0, but it is ${fixedPols[airName].EVPOL4[i]}`);
            assert(fixedPols[airName].CMUL[i] === 0n, `CMUL polynomial at row ${i} should be 0, but it is ${fixedPols[airName].CMUL[i]}`);
        } else if(i >= 6*poseidonGateUses.length && i < 6*poseidonGateUses.length + 6*poseidonCustGateUses.length) {
            assert(fixedPols[airName].PLONK[i] === 0n, `PLONK polynomial at row ${i} should be 0, but it is ${fixedPols[airName].PLONK[i]}`);
            assert(fixedPols[airName].POSEIDONSPONGE[i] === 0n, `POSEIDONSPONGE polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDONSPONGE[i]}`);
            if(i % 6 == 0)  {
                assert(fixedPols[airName].POSEIDONCOMPRESSION[i] === 1n, `POSEIDONCOMPRESSION polynomial at row ${i} should be 1, but it is ${fixedPols[airName].POSEIDONCOMPRESSION[i]}`);
            } else {
                assert(fixedPols[airName].POSEIDONCOMPRESSION[i] === 0n, `POSEIDONCOMPRESSION polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDONCOMPRESSION[i]}`);
            }
            if(i % 6 == 5) {
                assert(fixedPols[airName].POSEIDON_FINAL[i] === 1n, `POSEIDON_FINAL polynomial at row ${i} should be 1, but it is ${fixedPols[airName].POSEIDON_FINAL[i]}`);
            } else {
                assert(fixedPols[airName].POSEIDON_FINAL[i] === 0n, `POSEIDON_FINAL polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDON_FINAL[i]}`);
            }
            if(i % 6 == 3) {
                assert(fixedPols[airName].POSEIDON_PARTIAL_ROUND[i] === 1n, `POSEIDON_PARTIAL_ROUND polynomial at row ${i} should be 1, but it is ${fixedPols[airName].POSEIDON_PARTIAL_ROUND[i]}`);
            } else {
                assert(fixedPols[airName].POSEIDON_PARTIAL_ROUND[i] === 0n, `POSEIDON_PARTIAL_ROUND polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDON_PARTIAL_ROUND[i]}`);
            }
            assert(fixedPols[airName].FFT4[i] === 0n, `FFT4 polynomial at row ${i} should be 0, but it is ${fixedPols[airName].FFT4[i]}`);
            assert(fixedPols[airName].TREESELECTOR4[i] === 0n, `TREESELECTOR4 polynomial at row ${i} should be 0, but it is ${fixedPols[airName].TREESELECTOR4[i]}`);
            assert(fixedPols[airName].EVPOL4[i] === 0n, `EVPOL4 polynomial at row ${i} should be 0, but it is ${fixedPols[airName].EVPOL4[i]}`);
            assert(fixedPols[airName].CMUL[i] === 0n, `CMUL polynomial at row ${i} should be 0, but it is ${fixedPols[airName].CMUL[i]}`);
        } else if(i >= 6*poseidonGateUses.length + 6*poseidonCustGateUses.length && i < 6*poseidonGateUses.length + 6*poseidonCustGateUses.length + obj.nCMulRows) {
            assert(fixedPols[airName].PLONK[i] === 0n, `PLONK polynomial at row ${i} should be 0, but it is ${fixedPols[airName].PLONK[i]}`);
            assert(fixedPols[airName].POSEIDONSPONGE[i] === 0n, `POSEIDONSPONGE polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDONSPONGE[i]}`);
            assert(fixedPols[airName].POSEIDONCOMPRESSION[i] === 0n, `POSEIDONCOMPRESSION polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDONCOMPRESSION[i]}`);
            assert(fixedPols[airName].POSEIDON_FINAL[i] === 0n, `POSEIDON_FINAL polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDON_FINAL[i]}`);
            assert(fixedPols[airName].POSEIDON_PARTIAL_ROUND[i] === 0n, `POSEIDON_PARTIAL_ROUND polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDON_PARTIAL_ROUND[i]}`);
            assert(fixedPols[airName].FFT4[i] === 0n, `FFT4 polynomial at row ${i} should be 0, but it is ${fixedPols[airName].FFT4[i]}`);
            assert(fixedPols[airName].TREESELECTOR4[i] === 0n, `TREESELECTOR4 polynomial at row ${i} should be 0, but it is ${fixedPols[airName].TREESELECTOR4[i]}`);
            assert(fixedPols[airName].EVPOL4[i] === 0n, `EVPOL4 polynomial at row ${i} should be 0, but it is ${fixedPols[airName].EVPOL4[i]}`);
            assert(fixedPols[airName].CMUL[i] === 1n, `CMUL polynomial at row ${i} should be 1, but it is ${fixedPols[airName].CMUL[i]}`);
        } else if(i >= 6*poseidonGateUses.length + 6*poseidonCustGateUses.length + obj.nCMulRows && i < 6*poseidonGateUses.length + 6*poseidonCustGateUses.length + obj.nCMulRows + evPol4GateUses.length) {
            assert(fixedPols[airName].PLONK[i] === 0n, `PLONK polynomial at row ${i} should be 0, but it is ${fixedPols[airName].PLONK[i]}`);
            assert(fixedPols[airName].POSEIDONSPONGE[i] === 0n, `POSEIDONSPONGE polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDONSPONGE[i]}`);
            assert(fixedPols[airName].POSEIDONCOMPRESSION[i] === 0n, `POSEIDONCOMPRESSION polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDONCOMPRESSION[i]}`);
            assert(fixedPols[airName].POSEIDON_FINAL[i] === 0n, `POSEIDON_FINAL polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDON_FINAL[i]}`);
            assert(fixedPols[airName].POSEIDON_PARTIAL_ROUND[i] === 0n, `POSEIDON_PARTIAL_ROUND polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDON_PARTIAL_ROUND[i]}`);
            assert(fixedPols[airName].FFT4[i] === 0n, `FFT4 polynomial at row ${i} should be 0, but it is ${fixedPols[airName].FFT4[i]}`);
            assert(fixedPols[airName].TREESELECTOR4[i] === 0n, `TREESELECTOR4 polynomial at row ${i} should be 0, but it is ${fixedPols[airName].TREESELECTOR4[i]}`);
            assert(fixedPols[airName].EVPOL4[i] === 1n, `EVPOL4 polynomial at row ${i} should be 1, but it is ${fixedPols[airName].EVPOL4[i]}`);
            assert(fixedPols[airName].CMUL[i] === 0n, `CMUL polynomial at row ${i} should be 0, but it is ${fixedPols[airName].CMUL[i]}`);
        } else if(i >= 6*poseidonGateUses.length + 6*poseidonCustGateUses.length + obj.nCMulRows + evPol4GateUses.length && i < 6*poseidonGateUses.length + 6*poseidonCustGateUses.length + obj.nCMulRows + fft4GateUses.length + evPol4GateUses.length) {
            assert(fixedPols[airName].PLONK[i] === 0n, `PLONK polynomial at row ${i} should be 0, but it is ${fixedPols[airName].PLONK[i]}`);
            assert(fixedPols[airName].POSEIDONSPONGE[i] === 0n, `POSEIDONSPONGE polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDONSPONGE[i]}`);
            assert(fixedPols[airName].POSEIDONCOMPRESSION[i] === 0n, `POSEIDONCOMPRESSION polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDONCOMPRESSION[i]}`);
            assert(fixedPols[airName].POSEIDON_FINAL[i] === 0n, `POSEIDON_FINAL polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDON_FINAL[i]}`);
            assert(fixedPols[airName].POSEIDON_PARTIAL_ROUND[i] === 0n, `POSEIDON_PARTIAL_ROUND polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDON_PARTIAL_ROUND[i]}`);
            assert(fixedPols[airName].FFT4[i] === 1n, `FFT4 polynomial at row ${i} should be 1, but it is ${fixedPols[airName].FFT4[i]}`);
            assert(fixedPols[airName].TREESELECTOR4[i] === 0n, `TREESELECTOR4 polynomial at row ${i} should be 0, but it is ${fixedPols[airName].TREESELECTOR4[i]}`);
            assert(fixedPols[airName].EVPOL4[i] === 0n, `EVPOL4 polynomial at row ${i} should be 0, but it is ${fixedPols[airName].EVPOL4[i]}`);
            assert(fixedPols[airName].CMUL[i] === 0n, `CMUL polynomial at row ${i} should be 0, but it is ${fixedPols[airName].CMUL[i]}`);
        } else if(i >= 6*poseidonGateUses.length + 6*poseidonCustGateUses.length + obj.nCMulRows + evPol4GateUses.length + fft4GateUses.length && i < 6*poseidonGateUses.length + 6*poseidonCustGateUses.length + obj.nCMulRows + fft4GateUses.length + evPol4GateUses.length + treeSelector4GateUses.length) {
            assert(fixedPols[airName].PLONK[i] === 0n, `PLONK polynomial at row ${i} should be 0, but it is ${fixedPols[airName].PLONK[i]}`);
            assert(fixedPols[airName].POSEIDONSPONGE[i] === 0n, `POSEIDONSPONGE polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDONSPONGE[i]}`);
            assert(fixedPols[airName].POSEIDONCOMPRESSION[i] === 0n, `POSEIDONCOMPRESSION polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDONCOMPRESSION[i]}`);
            assert(fixedPols[airName].POSEIDON_FINAL[i] === 0n, `POSEIDON_FINAL polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDON_FINAL[i]}`);
            assert(fixedPols[airName].POSEIDON_PARTIAL_ROUND[i] === 0n, `POSEIDON_PARTIAL_ROUND polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDON_PARTIAL_ROUND[i]}`);
            assert(fixedPols[airName].FFT4[i] === 0n, `FFT4 polynomial at row ${i} should be 0, but it is ${fixedPols[airName].FFT4[i]}`);
            assert(fixedPols[airName].TREESELECTOR4[i] === 1n, `TREESELECTOR4 polynomial at row ${i} should be 1, but it is ${fixedPols[airName].TREESELECTOR4[i]}`);
            assert(fixedPols[airName].EVPOL4[i] === 0n, `EVPOL4 polynomial at row ${i} should be 0, but it is ${fixedPols[airName].EVPOL4[i]}`);
            assert(fixedPols[airName].CMUL[i] === 0n, `CMUL polynomial at row ${i} should be 0, but it is ${fixedPols[airName].CMUL[i]}`);
        } else if(i >= 6*poseidonGateUses.length + 6*poseidonCustGateUses.length + obj.nCMulRows + evPol4GateUses.length + fft4GateUses.length + treeSelector4GateUses.length && i < NUsed) {
            assert(fixedPols[airName].PLONK[i] === 1n, `PLONK polynomial at row ${i} should be 1, but it is ${fixedPols[airName].PLONK[i]}`);
            assert(fixedPols[airName].POSEIDONSPONGE[i] === 0n, `POSEIDONSPONGE polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDONSPONGE[i]}`);
            assert(fixedPols[airName].POSEIDONCOMPRESSION[i] === 0n, `POSEIDONCOMPRESSION polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDONCOMPRESSION[i]}`);
            assert(fixedPols[airName].POSEIDON_FINAL[i] === 0n, `POSEIDON_FINAL polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDON_FINAL[i]}`);
            assert(fixedPols[airName].POSEIDON_PARTIAL_ROUND[i] === 0n, `POSEIDON_PARTIAL_ROUND polynomial at row ${i} should be 0, but it is ${fixedPols[airName].POSEIDON_PARTIAL_ROUND[i]}`);
            assert(fixedPols[airName].FFT4[i] === 0n, `FFT4 polynomial at row ${i} should be 0, but it is ${fixedPols[airName].FFT4[i]}`);
            assert(fixedPols[airName].TREESELECTOR4[i] === 0n, `TREESELECTOR4 polynomial at row ${i} should be 0, but it is ${fixedPols[airName].TREESELECTOR4[i]}`);
            assert(fixedPols[airName].EVPOL4[i] === 0n, `EVPOL4 polynomial at row ${i} should be 0, but it is ${fixedPols[airName].EVPOL4[i]}`);
            assert(fixedPols[airName].CMUL[i] === 0n, `CMUL polynomial at row ${i} should be 0, but it is ${fixedPols[airName].CMUL[i]}`);
        }
    }

    const nColsConnections = 24;

    // Calculate S Polynomials
    const ks = getKs(nColsConnections - 1);
    let w = 1n;
    for (let i=0; i<N; i++) {
        if ((i%10000) == 0) console.log(`Point check -> Preparing S... ${i}/${N}`);
        fixedPols[airName].S[0][i] = w;
        for (let j=1; j<nColsConnections; j++) {
            fixedPols[airName].S[j][i] = (w * ks[j - 1]) % GOLDILOCKS_P;
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
                    connect(fixedPols[airName].S[ls.col],ls.row, fixedPols[airName].S[j],i);
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
        for (let k=0; k<10; k++) {
            fixedPols[airName].C[k][r] = 0n;
        }
        r +=1;
    }

    return {
        pilStr,
        pilout,
        constPols: fixedPols,
        nBits,
        sMap: sMap,
        plonkAdditions
    };
}
