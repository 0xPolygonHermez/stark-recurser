const { assert } = require("chai");
const fs = require("fs");
const path = require("path");
const {tmpName} = require("tmp-promise");
const { compile } = require("pilcom");
const ejs = require("ejs");
const {D, C} = require("../../utils/hash/poseidon/poseidon2_constants.js");
const { getCompressorConstraints } = require("../compressor_constraints.js");
const { connect, log2, getKs } = require("../../utils/utils.js");
const { generateFixedCols } = require("../../utils/witnessCalculator.js");


/*
    Compress plonk constraints and verifies custom gates using 21 committed polynomials
*/
module.exports = async function plonkSetup(F, r1cs, pil2, options) {
    const committedPols = 21;
    
    const {plonkAdditions, plonkConstraints, customGatesInfo, NUsed} = getCompressorConstraints(F, r1cs, 21);

    //Calculate the first power of 2 that's bigger than the number of constraints
    let nBits = log2(NUsed - 1) + 1;

    // Calculate the total number of publics used in PIL and how many rows are needed to store all of them (remember that each row can store up to 12 values)
    let nPublics = r1cs.nOutputs + r1cs.nPubInputs;
    const nPublicRows = Math.floor((nPublics + 20)/21);

    if (options.forceNBits) {
        if (options.forceNBits < nBits) {
            throw new Error("ForceNBits is less than required");
        }
        nBits = options.forceNBits;
    }
    const N = 1 << nBits; // First power of 2 whose value is higher than the number of constraints

    console.log(`NUsed: ${NUsed}`);
    console.log(`nBits: ${nBits}, 2^nBits: ${N}`);

    const template = await fs.promises.readFile(path.join(__dirname, "compressor18.pil.ejs"), "utf8");
    const obj = {
        nBits: nBits,
        nPublics: nPublics,
        D,
        C,
        committedPols,
    };

    const pilStr = ejs.render(template ,  obj);
    const pilFile = await tmpName();
    await fs.promises.writeFile(pilFile, pilStr, "utf8");

    if(pil2) {
        const tmpPath = path.resolve(__dirname, '../tmp');
        if(!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);
        let piloutPath = path.join(tmpPath, "pilout.ptb");
        let pilConfig = { outputFile: piloutPath};
        compilePil2(F, pilFile, null, pilConfig);
        
        const piloutEncoded = fs.readFileSync(piloutPath);
        const pilOutProtoPath = path.resolve(__dirname, '../node_modules/pil2-compiler/src/pilout.proto');
        const PilOut = protobuf.loadSync(pilOutProtoPath).lookupType("PilOut");
        let pilout = PilOut.toObject(PilOut.decode(piloutEncoded));
        
        constPols = generateFixedCols(pilout.symbols, pil.airgroups[0].airs[0].numRows);
    } else {
        const pil = await compile(F, pilFile);
        constPols = generateFixedCols(pil.references, Object.values(pil.references)[0].polDeg, false);
    }

    fs.promises.unlink(pilFile);

    // Stores the positions of all the values that each of the committed polynomials takes in each row 
    // Remember that there are 21 committed polynomials and the number of rows is stored in NUsed
    const sMap = [];
    for (let i=0;i<committedPols; i++) {
        sMap[i] = new Uint32Array(N).fill(0);
    }

    const threeExtraConstraints = [];
    const twoExtraConstraints = [];
    const oneExtraConstraints = [];
    
    let partialRowsCMul = -1;

    // Store the public inputs position in the mapping sMap
    // All constant polynomials are set to 0
    for (let i=0; i<nPublicRows; i++) {
        constPols.Compressor.EVPOL4[i] = 0n;
        constPols.Compressor.CMUL[i] = 0n;
        constPols.Compressor.GATE[i] = 0n;
        constPols.Compressor.GATE2[i] = 0n;
        constPols.Compressor.GATE3[i] = 0n;
        constPols.Compressor.POSEIDONFULLROUND[i] = 0n;
        constPols.Compressor.POSEIDONFINALROUND[i] = 0n;
        constPols.Compressor.POSEIDONFIRST[i] = 0n;
        constPols.Compressor.POSEIDONPARTIALROUND[i] = 0n;
        constPols.Compressor.POSEIDONCUSTFIRST[i] = 0n;
        constPols.Compressor.FFT4[i] = 0n;
        constPols.Compressor.TREESELECTOR4[i] = 0n;
        for (let k=0; k<21; k++) {
            const nPub = 21*i + k;
            // Since each row contains 21 public inputs, it is possible that
            // the last row is partially empty. Therefore, fulfill that last row
            // with 0.
            if(nPub < nPublics) {
                sMap[nPub%21][Math.floor(nPub/21)] = 1+nPub;
            } else {
                sMap[nPub%21][Math.floor(nPub/21)] = 0;
            }
        }

        for (let k=0; k<10; k++) {
            constPols.Compressor.C[k][i] = 0n;
        }
    }
    
    let r = nPublicRows;

    // Generate Custom Gates
    for (let i=0; i<r1cs.customGatesUses.length; i++) {
        if ((i%10000) == 0) console.log(`Point check -> Processing custom gates... ${i}/${r1cs.customGatesUses.length}`);
        const cgu = r1cs.customGatesUses[i];
        if (cgu.id == customGatesInfo.Poseidon12Id) {
            assert(cgu.signals.length == 11*12);
                
            let counterS = 0;

            for (let i = 0; i < 6; ++i) {
                for (let j = 0; j<12; j++) {
                    sMap[j][r+i] = cgu.signals[counterS++];
                }

                // Poseidon custom gates store all intermediate rounds (each round uses 12 inputs), but in C18 
                // we are verifying two rounds at a time. Therefore, we skip intermediate values that aren't used
                counterS += 12;

                constPols.Compressor.GATE[r+i] = 0n;
                constPols.Compressor.GATE2[r+i] = 0n;
                constPols.Compressor.GATE3[r+i] = 0n;
                constPols.Compressor.POSEIDONFULLROUND[r+i] = [0,1,3,4].includes(i); // Inputs -> Round 2, Round2 -> Round4, Round26 -> Round28, Round28 -> Outputs 
                constPols.Compressor.POSEIDONFINALROUND[r+i] = i === 4 ? 1n : 0n; // Round 28 -> Outputs;
                constPols.Compressor.POSEIDONCUSTFIRST[r+i] = 0n;
                constPols.Compressor.POSEIDONFIRST[r+i] = i === 0 ? 1n : 0n; // Inputs -> Round 2
                constPols.Compressor.POSEIDONPARTIALROUND[r+i] = i === 2 ? 1n : 0n; // Round 4 -> Round 26
                constPols.Compressor.CMUL[r+i] = 0n;
                constPols.Compressor.EVPOL4[r+i] = 0n;
                constPols.Compressor.TREESELECTOR4[r+i] = 0n;
                constPols.Compressor.FFT4[r+i] = 0n;

                for (let k=0; k<10; k++) {
                    constPols.Compressor.C[k][r+i] = 0n;
                }
                
                // Add each row to extraRows so that a[12], a[13], a[14] and a[15], a[16] and a[17] along with C[6], C[7], C[8], C[9], C[10] 
                // can be used to verify two sets of plonk constraints
                threeExtraConstraints.push(r+i);
            }

            r+=6;
        } else if(cgu.id == customGatesInfo.CustPoseidon12Id) {
            assert(cgu.signals.length == 11*12 + 2);
            let counterS = 0;
            let first_bit = cgu.signals[12];
            let second_bit = cgu.signals[13];

            sMap[18][r] = first_bit;
            sMap[19][r] = second_bit;
            
            for (let i = 0; i < 6; ++i) {
                for (let j = 0; j<12; j++) {
                    sMap[j][r+i] = cgu.signals[counterS++];
                }

                if (i == 0) counterS += 2;

                // Poseidon custom gates store all intermediate rounds (each round uses 12 inputs), but in C18 
                // we are verifying two rounds at a time. Therefore, we skip intermediate values that aren't used
                counterS += 12;

                constPols.Compressor.GATE[r+i] = 0n;
                constPols.Compressor.GATE2[r+i] = 0n;
                constPols.Compressor.GATE3[r+i] = 0n;
                constPols.Compressor.POSEIDONFULLROUND[r+i] = [0,1,3,4].includes(i); // Inputs -> Round 2, Round2 -> Round4, Round26 -> Round28, Round28 -> Outputs 
                constPols.Compressor.POSEIDONFINALROUND[r+i] = i === 4 ? 1n : 0n; // Round 28 -> Outputs;
                constPols.Compressor.POSEIDONCUSTFIRST[r+i] = i === 0 ? 1n : 0n; // Inputs -> Round 2
                constPols.Compressor.POSEIDONFIRST[r+i] = 0n;
                constPols.Compressor.POSEIDONPARTIALROUND[r+i] = i === 2 ? 1n : 0n; // Round 4 -> Round 26
                constPols.Compressor.CMUL[r+i] = 0n;
                constPols.Compressor.EVPOL4[r+i] = 0n;
                constPols.Compressor.TREESELECTOR4[r+i] = 0n;
                constPols.Compressor.FFT4[r+i] = 0n;

                for (let k=0; k<10; k++) {
                    constPols.Compressor.C[k][r+i] = 0n;
                }

                // Add each row to extraRows so that a[12], a[13], a[14] and a[15], a[16] and a[17] along with C[6], C[7], C[8], C[9], C[10] 
                // can be used to verify two sets of plonk constraints
                if(i != 0) {
                    threeExtraConstraints.push(r+i);
                } else {
                    twoExtraConstraints.push(r+i);
                }
            }

            r+=6;
        } else if (cgu.id == customGatesInfo.CMulId) {
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
                constPols.Compressor.CMUL[r] = 1n;
                constPols.Compressor.GATE[r] = 0n;
                constPols.Compressor.GATE2[r] = 0n;
                constPols.Compressor.GATE3[r] = 0n;
                constPols.Compressor.POSEIDONFULLROUND[r] = 0n;
                constPols.Compressor.POSEIDONFINALROUND[r] = 0n;
                constPols.Compressor.POSEIDONFIRST[r] = 0n;
                constPols.Compressor.POSEIDONPARTIALROUND[r] = 0n;
                constPols.Compressor.POSEIDONCUSTFIRST[r] = 0n;
                constPols.Compressor.EVPOL4[r] = 0n;
                constPols.Compressor.TREESELECTOR4[r] = 0n;
                constPols.Compressor.FFT4[r] = 0n;
                
                for (let k=0; k<10; k++) {
                    constPols.Compressor.C[k][r] = 0n;
                }
                partialRowsCMul = r;
                oneExtraConstraints.push(r);
                r+= 1;
            }
        } else if ( typeof customGatesInfo.FFT4Parameters[cgu.id] !== "undefined") {
            for (let i=0; i<12; i++) {
                sMap[i][r] = cgu.signals[i];
                sMap[i][r+1] = cgu.signals[12+i];
            }
            constPols.Compressor.CMUL[r] = 0n;
            constPols.Compressor.GATE[r] = 0n;
            constPols.Compressor.GATE2[r] = 0n;
            constPols.Compressor.GATE3[r] = 0n;
            constPols.Compressor.POSEIDONFULLROUND[r] = 0n;
            constPols.Compressor.POSEIDONFINALROUND[r] = 0n;
            constPols.Compressor.POSEIDONFIRST[r] = 0n;
            constPols.Compressor.POSEIDONPARTIALROUND[r] = 0n;
            constPols.Compressor.POSEIDONCUSTFIRST[r] = 0n;
            constPols.Compressor.EVPOL4[r] = 0n;
            constPols.Compressor.TREESELECTOR4[r] = 0n;
            constPols.Compressor.FFT4[r] = 1n;

            constPols.Compressor.CMUL[r+1] = 0n;
            constPols.Compressor.GATE[r+1] = 0n;
            constPols.Compressor.GATE2[r+1] = 0n;
            constPols.Compressor.GATE3[r+1] = 0n;
            constPols.Compressor.POSEIDONFULLROUND[r+1] = 0n;
            constPols.Compressor.POSEIDONFINALROUND[r+1] = 0n;
            constPols.Compressor.POSEIDONFIRST[r+1] = 0n;
            constPols.Compressor.POSEIDONPARTIALROUND[r+1] = 0n;
            constPols.Compressor.POSEIDONCUSTFIRST[r+1] = 0n;
            constPols.Compressor.EVPOL4[r+1] = 0n;
            constPols.Compressor.TREESELECTOR4[r+1] = 0n;
            constPols.Compressor.FFT4[r+1] = 0n;

            const type = customGatesInfo.FFT4Parameters[cgu.id][3];
            const scale = customGatesInfo.FFT4Parameters[cgu.id][2];
            const firstW = customGatesInfo.FFT4Parameters[cgu.id][0];
            const firstW2 = F.square(firstW);
            const incW = customGatesInfo.FFT4Parameters[cgu.id][1];
            if (type == 4n) {
                constPols.Compressor.C[0][r] = scale;
                constPols.Compressor.C[1][r] = F.mul(scale, firstW2);
                constPols.Compressor.C[2][r] = F.mul(scale, firstW);
                constPols.Compressor.C[3][r] = F.mul(scale, F.mul(firstW, firstW2));
                constPols.Compressor.C[4][r] = F.mul(scale, F.mul(firstW, incW));
                constPols.Compressor.C[0][r+1] = F.mul(F.mul(scale,firstW), F.mul(firstW2, incW));
                constPols.Compressor.C[1][r+1] = 0n;
                constPols.Compressor.C[2][r+1] = 0n;
                constPols.Compressor.C[3][r+1] = 0n;
                constPols.Compressor.C[4][r+1] = 0n;
            } else if (type == 2n) {
                constPols.Compressor.C[0][r] = 0n;
                constPols.Compressor.C[1][r] = 0n;
                constPols.Compressor.C[2][r] = 0n;
                constPols.Compressor.C[3][r] = 0n;
                constPols.Compressor.C[4][r] = 0n;
                constPols.Compressor.C[0][r+1] = 0n;
                constPols.Compressor.C[1][r+1] = scale;
                constPols.Compressor.C[2][r+1] = F.mul(scale, firstW);
                constPols.Compressor.C[3][r+1] = F.mul(scale, F.mul(firstW, incW));
                constPols.Compressor.C[4][r+1] = 0n;
            } else {
                throw new Error("Invalid FFT4 type: "+cgu.parameters[0]);
            }

            for (let k=5; k<10; k++) {
                constPols.Compressor.C[k][r] = 0n;
                constPols.Compressor.C[k][r+1] = 0n;
            }
            threeExtraConstraints.push(r);
            threeExtraConstraints.push(r+1);

            r+= 2;
        } else if (cgu.id == customGatesInfo.EvPol4Id) {
            for (let i=0; i<21; i++) {
                sMap[i][r] = cgu.signals[i];
            }
            constPols.Compressor.EVPOL4[r] = 1n;
            constPols.Compressor.TREESELECTOR4[r] = 0n;
            constPols.Compressor.CMUL[r] = 0n;
            constPols.Compressor.GATE[r] = 0n;
            constPols.Compressor.GATE2[r] = 0n;
            constPols.Compressor.GATE3[r] = 0n;
            constPols.Compressor.POSEIDONFULLROUND[r] = 0n;
            constPols.Compressor.POSEIDONFINALROUND[r] = 0n;
            constPols.Compressor.POSEIDONFIRST[r] = 0n;
            constPols.Compressor.POSEIDONPARTIALROUND[r] = 0n;
            constPols.Compressor.POSEIDONCUSTFIRST[r] = 0n;
            constPols.Compressor.FFT4[r] = 0n;

            for (let k=0; k<10; k++) {
                constPols.Compressor.C[k][r] = 0n;
            }
            r+= 1;
        } else if(cgu.id == customGatesInfo.TreeSelector4Id) {
            assert(cgu.signals.length === 17);
            for (let i=0; i<17; i++) {
                sMap[i][r] = cgu.signals[i];
            }

            constPols.Compressor.EVPOL4[r] = 0n;
            constPols.Compressor.TREESELECTOR4[r] = 1n;
            constPols.Compressor.CMUL[r] = 0n;
            constPols.Compressor.GATE[r] = 0n;
            constPols.Compressor.GATE2[r] = 0n;
            constPols.Compressor.GATE3[r] = 0n;
            constPols.Compressor.POSEIDONFULLROUND[r] = 0n;
            constPols.Compressor.POSEIDONFINALROUND[r] = 0n;
            constPols.Compressor.POSEIDONFIRST[r] = 0n;
            constPols.Compressor.POSEIDONPARTIALROUND[r] = 0n;
            constPols.Compressor.POSEIDONCUSTFIRST[r] = 0n;
            constPols.Compressor.FFT4[r] = 0n;

            for (let k=0; k<10; k++) {
                constPols.Compressor.C[k][r] = 0n;
            }
            oneExtraConstraints.push(r);
            r += 1;
        } else {
            throw new Error("Custom gate not defined", cgu.id);
        }
    }

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
           
            if(pr.nUsed === 6) constPols.Compressor.GATE3[pr.row] = 1n;
            pr.nUsed++;
            if(pr.nUsed === 2 || (pr.nUsed == 6 && !pr.useLast) || pr.nUsed === 7) {
                delete partialRows[k];
            }
        // If the constraint is not stored in partialRows (which means that there is no other row that is using this very same set of constraints and is not full)
        // check if there's any half row. If that's the case, attach the new set of constraints values to that row 
        } else if (halfRows.length > 0) {
            const pr = halfRows.shift();
            if(pr.nUsed === 2) {
                constPols.Compressor.C[5][pr.row] = c[3];
                constPols.Compressor.C[6][pr.row] = c[4];
                constPols.Compressor.C[7][pr.row] = c[5];
                constPols.Compressor.C[8][pr.row] = c[6];
                constPols.Compressor.C[9][pr.row] = c[7];

                sMap[6][pr.row] = c[0];
                sMap[7][pr.row] = c[1];
                sMap[8][pr.row] = c[2];
                sMap[9][pr.row] = c[0];
                sMap[10][pr.row] = c[1];
                sMap[11][pr.row] = c[2];
                sMap[12][pr.row] = c[0];
                sMap[13][pr.row] = c[1];
                sMap[14][pr.row] = c[2];
                sMap[15][pr.row] = c[0];
                sMap[16][pr.row] = c[1];
                sMap[17][pr.row] = c[2];

                pr.nUsed++;
                partialRows[k] = pr;
            } else {
                assert(false);
            }
        } else if(threeExtraConstraints.length > 0) {
            const row = threeExtraConstraints.shift();
            constPols.Compressor.GATE2[row] = 1n;
            
            constPols.Compressor.C[5][row] = c[3];
            constPols.Compressor.C[6][row] = c[4];
            constPols.Compressor.C[7][row] = c[5];
            constPols.Compressor.C[8][row] = c[6];
            constPols.Compressor.C[9][row] = c[7];
            
            sMap[12][row] = c[0];
            sMap[13][row] = c[1];
            sMap[14][row] = c[2];
            sMap[15][row] = c[0];
            sMap[16][row] = c[1];
            sMap[17][row] = c[2];
            sMap[18][row] = c[0];
            sMap[19][row] = c[1];
            sMap[20][row] = c[2];
            
            partialRows[k] = {
                row: row,
                nUsed: 5,
                useLast: true,
            };
        } else if(twoExtraConstraints.length > 0) {
            const row = twoExtraConstraints.shift();
            constPols.Compressor.GATE2[row] = 1n;
            
            constPols.Compressor.C[5][row] = c[3];
            constPols.Compressor.C[6][row] = c[4];
            constPols.Compressor.C[7][row] = c[5];
            constPols.Compressor.C[8][row] = c[6];
            constPols.Compressor.C[9][row] = c[7];
            
            sMap[12][row] = c[0];
            sMap[13][row] = c[1];
            sMap[14][row] = c[2];
            sMap[15][row] = c[0];
            sMap[16][row] = c[1];
            sMap[17][row] = c[2];
            partialRows[k] = {
                row: row,
                nUsed: 5,
                useLast: false,
            };
        } else if(oneExtraConstraints.length > 0) {
            const row = oneExtraConstraints.shift();
            constPols.Compressor.GATE3[row] = 1n;

            constPols.Compressor.C[5][row] = c[3];
            constPols.Compressor.C[6][row] = c[4];
            constPols.Compressor.C[7][row] = c[5];
            constPols.Compressor.C[8][row] = c[6];
            constPols.Compressor.C[9][row] = c[7];

            sMap[18][row] = c[0];
            sMap[19][row] = c[1];
            sMap[20][row] = c[2];
        // If the constraint is not stored in partialRows and all previous rows are full, start a new one
        } else {
            constPols.Compressor.C[0][r] = c[3];
            constPols.Compressor.C[1][r] = c[4];
            constPols.Compressor.C[2][r] = c[5];
            constPols.Compressor.C[3][r] = c[6];
            constPols.Compressor.C[4][r] = c[7];
            constPols.Compressor.GATE[r] = 1n;
            constPols.Compressor.GATE2[r] = 0n;
            constPols.Compressor.GATE3[r] = 0n;
            constPols.Compressor.EVPOL4[r] = 0n;
            constPols.Compressor.CMUL[r] = 0n;
            constPols.Compressor.POSEIDONFULLROUND[r] = 0n;
            constPols.Compressor.POSEIDONFINALROUND[r] = 0n;
            constPols.Compressor.POSEIDONFIRST[r] = 0n;
            constPols.Compressor.POSEIDONPARTIALROUND[r] = 0n;
            constPols.Compressor.POSEIDONCUSTFIRST[r] = 0n;
            constPols.Compressor.FFT4[r] = 0n;
            constPols.Compressor.TREESELECTOR4[r] = 0n;
            sMap[0][r] = c[0];
            sMap[1][r] = c[1];
            sMap[2][r] = c[2];
            sMap[3][r] = c[0];
            sMap[4][r] = c[1];
            sMap[5][r] = c[2];
            
            // Add the partial row
            partialRows[k] = {
                row: r,
                nUsed: 1
            };

            halfRows.push({
                row: r,
                nUsed: 2,
                useLast: true,
            });

            for(let i = 6; i < 10; ++i) {
                sMap[i][r] = 0;
                constPols.Compressor.C[i][r] = 0n;
            }

            r++;
        }
    }

    assert(r == NUsed);

    // Calculate S Polynomials
    const ks = getKs(F, committedPols - 1);
    let w = F.one;
    for (let i=0; i<N; i++) {
        if ((i%10000) == 0) console.log(`Point check -> Preparing S... ${i}/${N}`);
        constPols.Compressor.S[0][i] = w;
        for (let j=1; j<committedPols; j++) {
            constPols.Compressor.S[j][i] = F.mul(w, ks[j-1]);
        }
        w = F.mul(w, F.w[nBits]);
    }

    let connections = 0;
    const lastSignal = {}
    for (let i=0; i<r; i++) {
        if ((i%10000) == 0) console.log(`Point check -> Connection S... ${i}/${r}`);
        for (let j=0; j<committedPols; j++) {
            if (sMap[j][i]) {
                if (typeof lastSignal[sMap[j][i]] !== "undefined") {
                    const ls = lastSignal[sMap[j][i]];
                    connections++;
                    connect(constPols.Compressor.S[ls.col],ls.row, constPols.Compressor.S[j],i);
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
        constPols.Compressor.TREESELECTOR4[r] = 0n;
        constPols.Compressor.EVPOL4[r] = 0n;
        constPols.Compressor.CMUL[r] = 0n;
        constPols.Compressor.GATE[r] = 0n;
        constPols.Compressor.GATE2[r] = 0n;
        constPols.Compressor.GATE3[r] = 0n;
        constPols.Compressor.POSEIDONFULLROUND[r] = 0n;
        constPols.Compressor.POSEIDONFINALROUND[r] = 0n;
        constPols.Compressor.POSEIDONFIRST[r] = 0n;
        constPols.Compressor.POSEIDONPARTIALROUND[r] = 0n;
        constPols.Compressor.POSEIDONCUSTFIRST[r] = 0n;
        constPols.Compressor.FFT4[r] = 0n;
        for (let k=0; k<10; k++) {
            constPols.Compressor.C[k][r] = 0n;
        }
        r +=1;
    }

    // Calculate the Lagrangian Polynomials for the public rows
    // Its value is 1 on the i^th row and 0 otherwise
    for (let i=0; i<nPublicRows; i++) {
        const L = constPols.Global["L" + (i+1)];
        for (let i=0; i<N; i++) {
            L[i] = 0n;
        }
        L[i] = 1n;
    }

    return {
        pilStr: pilStr,
        constPols: constPols,
        nBits: nBits,
        sMap: sMap,
        plonkAdditions: plonkAdditions
    };
}
