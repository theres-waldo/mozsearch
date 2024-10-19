#!/bin/bash
SOURCE_FILE=$1
/home/botond/programs/clang/debug/bin/clang++ -Xclang -load -Xclang clang-plugin/libclang-index-plugin.so -Xclang -add-plugin -Xclang mozsearch-index -Xclang -plugin-arg-mozsearch-index -Xclang tests/tests/files -Xclang -plugin-arg-mozsearch-index -Xclang host-scratch -Xclang -plugin-arg-mozsearch-index -Xclang host-scratch -Xclang -fparse-all-comments -DTEST_MACRO1 -DTEST_MACRO2 tests/tests/files/$SOURCE_FILE.cpp -std=c++17 -I tests/tests/files -I host-scratch -c -o host-scratch/$SOURCE_FILE.o -Wall

