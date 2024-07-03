pragma circom 2.1.0;

include "poseidon.circom";
include "mux1.circom";

template AggregateValues() {
    signal input valueA[4];
    signal input valueB[4];

    signal output valueAB[4];

    // Calculate the hash of valueA and valueB
    signal hash[12] <== Poseidon(12)([valueA[0], valueA[1], valueA[2], valueA[3], valueB[0], valueB[1], valueB[2], valueB[3]], [0,0,0,0]);
    value AB <== [hash[0], hash[1], hash[2], hash[3]];
}

template AggregateSubproofValues() {
    signal input subproofValueA[3];
    signal input subproofValueB[3];

    signal input {binary} aggregationType; // 1 if aggregation is multiplication, 0 if aggregation is addition

    signal output subproofValueAB[3];

    signal values[2][3];
    values[0] <== [subproofValueA[0] + subproofValueB[0], subproofValueA[1] + subproofValueB[1], subproofValueA[2] + subproofValueB[2]];
    values[1] <== [subproofValueA[0] * subproofValueB[0], subproofValueA[1] * subproofValueB[1], subproofValueA[2] * subproofValueB[2]];

    // Either add or multiply the subproofValues according to the aggregation type and then return the result
    subproofValueAB <== MultiMux1(3)(values, aggregationType);
}