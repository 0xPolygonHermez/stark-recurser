pragma circom 2.1.0;
pragma custom_templates;

include "mux1.circom";

template AggregateAirgroupValues() {
    signal input airgroupValueA[3];
    signal input airgroupValueB[3];

    signal input {binary} aggregationType; // 1 if aggregation is multiplication, 0 if aggregation is addition

    signal output airgroupValueAB[3];

    signal values[2][3];
    values[0] <== [airgroupValueA[0] + airgroupValueB[0], airgroupValueA[1] + airgroupValueB[1], airgroupValueA[2] + airgroupValueB[2]];
    values[1] <== [airgroupValueA[0] * airgroupValueB[0], airgroupValueA[1] * airgroupValueB[1], airgroupValueA[2] * airgroupValueB[2]];

    // Either add or multiply the airgroupvalues according to the aggregation type and then return the result
    airgroupValueAB <== MultiMux1(3)(values, aggregationType);
}

template AggregateAirgroupValuesNull() {
    signal input airgroupValueA[3];
    signal input airgroupValueB[3];
    signal input {binary} aggregationType; // 1 if aggregation is multiplication, 0 if aggregation is addition
    signal input {binary} isNullA; // 1 if is circuit type A is 0 (null), 0 otherwise 
    signal input {binary} isNullB; // 1 if is circuit type B is 0 (null), 0 otherwise 


    signal output airgroupValueAB[3];

    // If circuit type A is null, then its airgroupvalue is zero;
    signal valueA[3] <== [ (1 - isNullA)*airgroupValueA[0], (1 - isNullA)*airgroupValueA[1], (1 - isNullA)*airgroupValueA[2] ];

    // If circuit type B is null, then its airgroupvalue is zero;
    signal valueB[3] <== [ (1 - isNullB)*airgroupValueB[0], (1 - isNullB)*airgroupValueB[1], (1 - isNullB)*airgroupValueB[2] ];

    signal values[2][3];
    values[0] <== [valueA[0] + valueB[0], valueA[1] + valueB[1], valueA[2] + valueB[2]];
    values[1] <== [valueA[0] * valueB[0], valueA[1] * valueB[1], valueA[2] * valueB[2]];

    // Either add or multiply the airgroupvalues according to the aggregation type and then return the result
    airgroupValueAB <== MultiMux1(3)(values, aggregationType);
}