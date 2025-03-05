const r1cs2plonk = require("./r1cs2plonk.js");
const { getCustomGatesInfo, calculatePlonkConstraintsRowsC12, calculatePlonkConstraintsRowsC21 } = require("./compressor_helpers.js");

module.exports.getCompressorConstraints = function getCompressorConstraints(F, r1cs, cols) {
    // Calculate the number plonk Additions and plonk constraints from the R1CS
    const [plonkConstraints, plonkAdditions] = r1cs2plonk(F, r1cs);

    console.log(`Number of plonk constraints: ${plonkConstraints.length}`);

    // Given the PLONK Constraints, which have the following form: qL*a + qR*b + qM*a*b + qO*c + qC = 0,
    // calculate the number of constraints required in the compressed Plonk. 
    // Since each regular plonk constrain only uses 3 wires (a, b and c), and several sets of wires can share the same set of polynomial
    // gates, we can further extend the compression by storing 2 different sets of (a_i, b_i, c_i) for every set of (qL, qR, qM, Q0, qC)
    // the committed polynomial. 
    // In this particular case, we will store two sets of gates in every row. The first one will correspond to a[0], a[1], a[2] and a[3], a[4], a[5] 
    // and the second on will correspond to a[6], a[7], a[8] and a[9], a[10], a[11]
    // In addition to that, since the first row of TreeSelector custom gate only uses 6 committed polynomials and it doesn't use any constant value, we will 
    // verify two plonk constraints in those rows.
    // In the same way, since Cmul and EvalPol have 3 committed polynomial values empty we will verify two plonk constraints in each row

    // Get information about the custom gates from the R1CS
    const customGatesInfo = getCustomGatesInfo(r1cs);
    
    let NUsed;
    
    // Calculate the total number of publics used in PIL and how many rows are needed to store all of them (remember that each row can store up to 12 values)
    let nPublics = r1cs.nOutputs + r1cs.nPubInputs;
    let nPublicRows; 

    let nCMulRows;
    let nPoseidon12Rows;
    let nCustPoseidon12Rows;
    let nTotalPoseidon12Rows;
    let nFFT4Rows;
    let nEvPol4Rows;
    let nTreeSelector4Rows;

    if(cols === 12) {
        // Each Poseidon12 custom gate uses 11 rows (Input -> Round 1 -> Round 2 -> Round 3 -> Round 4 -> Round 15 -> Round 26 -> Round 27 -> Round 28 -> Round 29 -> Output)
        nPublicRows = Math.floor((nPublics + 11)/12);
        nCMulRows = customGatesInfo.nCMul;
        nPoseidon12Rows = customGatesInfo.nPoseidon12*11;
        nCustPoseidon12Rows = customGatesInfo.nCustPoseidon12*11;
        nTotalPoseidon12Rows = nPoseidon12Rows + nCustPoseidon12Rows;
        nFFT4Rows = customGatesInfo.nFFT4*2; // Each FFT4 custom gate uses 2 rows (1 for actually computing the FFT and the other one for checking the output)
        nEvPol4Rows = customGatesInfo.nEvPol4*2; // Each EvalPol4 custom gate uses 2 rows (1 for actually computing the evaluation and the other one for checking the output)
        nTreeSelector4Rows = customGatesInfo.nTreeSelector4*2;  // Each TreeSelector custom gate uses 2 rows

        const nPartialRowsCustomGates = nPublicRows + nCMulRows +nTotalPoseidon12Rows + nFFT4Rows + nEvPol4Rows + nTreeSelector4Rows;
        
        // Calculate how many  constraints are needed 
        const CPlonkConstraints = calculatePlonkConstraintsRowsC12(plonkConstraints, customGatesInfo.nEvPol4 + customGatesInfo.nCMul, customGatesInfo.nTreeSelector4);

        console.log(`Number of Plonk constraints stored in EvalPol -> ${customGatesInfo.nEvPol4*3}`)
        console.log(`Number of Plonk constraints stored in CMul and FFT4 -> ${(customGatesInfo.nCMul + customGatesInfo.nFFT4)*2}`)   
        console.log(`Number of plonk constraints new rows: ${CPlonkConstraints}`);
        
        NUsed = nPartialRowsCustomGates + CPlonkConstraints;
    } else if(cols === 21) {
        // Each Poseidon12 custom gate uses 6 rows (Input -> Round 2 -> Round 4 -> Round 26 -> Round 28 -> Output)
        nPublicRows = Math.floor((nPublics + 20)/21);
        nCMulRows = customGatesInfo.nCMul/2;
        nPoseidon12Rows = customGatesInfo.nPoseidon12*6;
        nCustPoseidon12Rows = customGatesInfo.nCustPoseidon12*6;
        nTotalPoseidon12Rows = nPoseidon12Rows + nCustPoseidon12Rows;
        nFFT4Rows = customGatesInfo.nFFT4*2;
        nEvPol4Rows = customGatesInfo.nEvPol4;
        nTreeSelector4Rows = customGatesInfo.nTreeSelector4;
        
        // Calculate how many groups of two plonk constraints can be made 
        const CPlonkConstraints = calculatePlonkConstraintsRowsC21(plonkConstraints,nTotalPoseidon12Rows + nFFT4Rows,customGatesInfo.nPoseidon12*6 + customGatesInfo.nCustPoseidon12 * 5 + nCMulRows + nTreeSelector4Rows);

        console.log(`Number of plonk constraints: ${plonkConstraints.length}`); 
        console.log(`Number of Plonk constraints stored in rows -> ${CPlonkConstraints}`);
        console.log(`Number of plonk constraints stored in custom gates: ${plonkConstraints.length - CPlonkConstraints}`);

        NUsed = CPlonkConstraints + nPublicRows + nCMulRows + nTotalPoseidon12Rows + nFFT4Rows + nEvPol4Rows + nTreeSelector4Rows;
    } else throw new Error("Invalid number of cols");

    console.log(`Number of publics: ${nPublics} -> Constraints: ${nPublicRows}`);
    console.log(`Number of CMul: ${customGatesInfo.nCMul} -> Constraints: ${nCMulRows}`);
    console.log(`Number of Poseidon12: ${customGatesInfo.nPoseidon12} -> Constraints: ${nPoseidon12Rows}`);
    console.log(`Number of Poseidon12 custom: ${customGatesInfo.nCustPoseidon12} -> Constraints: ${nCustPoseidon12Rows}`)
    console.log(`Total Number of Poseidon:  ${customGatesInfo.nPoseidon12 + customGatesInfo.nCustPoseidon12} -> Constraints ${nTotalPoseidon12Rows}`);
    console.log(`Number of FFT4: ${customGatesInfo.nFFT4} -> Constraints: ${nFFT4Rows}`);
    console.log(`Number of EvPol4: ${customGatesInfo.nEvPol4} -> Constraints: ${nEvPol4Rows}`);
    console.log(`Number of TreeSelector4: ${customGatesInfo.nTreeSelector4} -> Constraints: ${nTreeSelector4Rows}`);

    return {plonkConstraints, plonkAdditions, customGatesInfo, NUsed};
}