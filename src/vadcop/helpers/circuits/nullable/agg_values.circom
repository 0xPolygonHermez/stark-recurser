pragma circom 2.1.0;

include "mux1.circom";
include "mux2.circom";

template AggregateValues() {
    signal input valueA[4];
    signal input valueB[4];
    signal input {binary} isNullA; // 1 if is circuit type A is 0 (null), 0 otherwise
    signal input {binary} isNullB; // 1 if is circuit type B is 0 (null), 0 otherwise

    signal output valueAB[4];

    // Calculate the hash of valueA and valueB
    signal hash[12] <== Poseidon(12)([valueA[0], valueA[1], valueA[2], valueA[3], valueB[0], valueB[1], valueB[2], valueB[3]], [0,0,0,0]);
    signal hashAB[4] <== [hash[0], hash[1], hash[2], hash[3]];

    // If valueA or valueB is [0,0,0], it means that the particular subproof does not have that stage. Therefore we should proceed the same way as if circuitType is null
    signal isValueA1Zero <== IsZero()(valueA[0]);
    signal isValueA2Zero <== IsZero()(valueA[1]);
    signal isValueA3Zero <== IsZero()(valueA[2]);
    signal isValueA4Zero <== IsZero()(valueA[3]);
    signal isValueAZero <== IsZero()(4 - (isValueA1Zero + isValueA2Zero + isValueA3Zero + isValueA4Zero));

    signal isValueB1Zero <== IsZero()(valueB[0]);
    signal isValueB2Zero <== IsZero()(valueB[1]);
    signal isValueB3Zero <== IsZero()(valueB[2]);
    signal isValueB4Zero <== IsZero()(valueB[3]);
    signal isValueBZero <== IsZero()(4 - (isValueB1Zero + isValueB2Zero + isValueB3Zero + isValueB4Zero));


    // If circuit type A is null || valueA === 0 and circuit type B is null || valueB === 0, then the valueAB is 0
    // If circuit type A is not null && valueA !== 0 and circuit type B is null || valueB === 0, then the valueAB is valueA
    // If circuit type A is null || valueA === 0 and circuit type B is not null && valueB !== 0, then the valueAB is valueB
    // If circuit type A is not null && valueA !== 0 and circuit type B is not null && valueB !== 0, then the valueAB is hashAB

    signal {binary} s[2] <== [(1 - isNullA)*(1 - isValueAZero), (1 - isNullB)*(1 - isValueBZero)];
    valueAB <== MultiMux2(4)([[0,0,0,0], valueA, valueB, hashAB], s);

}

template AggregateSubproofValues() {
    signal input subproofValueA[3];
    signal input subproofValueB[3];
    signal input {binary} aggregationType; // 1 if aggregation is multiplication, 0 if aggregation is addition
    signal input {binary} isNullA; // 1 if is circuit type A is 0 (null), 0 otherwise 
    signal input {binary} isNullB; // 1 if is circuit type B is 0 (null), 0 otherwise 


    signal output subproofValueAB[3];

    // If circuit type A is null, then its subproofValue is zero;
    signal valueA[3] <== [ (1 - isNullA)*subproofValueA[0], (1 - isNullA)*subproofValueA[1], (1 - isNullA)*subproofValueA[2] ];

    // If circuit type B is null, then its subproofValue is zero;
    signal valueB[3] <== [ (1 - isNullB)*subproofValueB[0], (1 - isNullB)*subproofValueB[1], (1 - isNullB)*subproofValueB[2] ];

    signal values[2][3];
    values[0] <== [valueA[0] + valueB[0], valueA[1] + valueB[1], valueA[2] + valueB[2]];
    values[1] <== [valueA[0] * valueB[0], valueA[1] * valueB[1], valueA[2] * valueB[2]];

    // Either add or multiply the subproofValues according to the aggregation type and then return the result
    subproofValueAB <== MultiMux1(3)(values, aggregationType);
}