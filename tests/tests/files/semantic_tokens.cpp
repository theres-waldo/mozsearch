int gVar;

namespace Namespace {
  int n_var;
}

void function(int parameter) { int localVariable; }

class Class {
  int field;

  Class operator+(Class other);

  void method(int parameter) {
    Class a, b;
  label:
    Class c = a + b; // overloaded operator
    method(parameter + gVar + Namespace::n_var + field + 1);
  }
};

enum Enum { EnumConstant };

using Typedef = int;

template <typename TemplateParameter> void functionTemplate() {
  TemplateParameter::unknown;
}

template <typename> class ClassTemplate {};

//template <typename>
//concept Concept = true;

#define MACRO

