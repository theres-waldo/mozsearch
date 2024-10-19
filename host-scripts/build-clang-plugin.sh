#!/bin/bash

cd clang-plugin && DEBUG=1 LLVM_CONFIG=/home/botond/programs/clang/debug/bin/llvm-config make $@
