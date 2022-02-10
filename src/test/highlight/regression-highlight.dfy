// Issue #121: Generic and Regular should be highlighted
// with the same color
predicate Generic<Bar>(foo: Bar){}
predicate Generic<Bar<Foo>>(foo: Bar<Foo>){}
predicate Generic<Bar<Foo<Blah>>>(foo: Bar<Foo<Blah>>){}
predicate Generic<Bar<Foo<Blah<P>>>>(foo: Bar<Foo<Blah<P>>>){}
predicate Regular(foo: Baz){}

function test() {
  FunctionCall("hello")
             //^^^^^^^ should be a string
}

// Issue#120: 'Purple?' should be highlighted entirely
predicate Purple?(foo: Bar){}
predicate IsPurple(foo: Bar){}

// Issue#106: The three "bool" should be blue
datatype D = D((bool, int) -> bool) | E(bool)

// should be recognized as a keyword
datatype

method X() ensures (true) {
   //      ^^^^^^^ keyword
}

// Issue#85: Strings should be highlighted correctly.
method {:extern "foo"} Foo() returns (res: Result<string, string>)
      // ^^^^^^ attribute
ensures {:verify false} doSomething(res)
              // ^^^^^ keyword
  {
    :- Need(true, "Not a string, the parens are doing it ().");
    :- Need(!false, @"The code is highlighted as a string
    and this string is code");
    :- Need(false == false, "???");
  }

// Issue#79: `Foo1` is a function, and `string` is a type
//           Bar should be a function
function Foo1(bar: string): string {
  Bar<string>(bar)
  //  ^^^^^^ should be a highlighted keyword 
}

// Issue#79-1: `Foo2` should be a function
// Issue#79-2: `Bar` should be a function
function Foo2<T>(bar: T): T {
  Bar<Boxed<T>>(Box<T>(arg)).value
  //  ^^^^^ should be highlighted as a type
              //^^^ ^ method call + type
}
// Issue#79-3: `Bar` should be a function
function Bar<T>(arg: T): T {
         //  ^       ^   ^   should be a type
  arg
}

datatype Boxed<T> = Box(value: T)
//^^^^^^ keyword
//       ^^^^^ type
//             ^ type

datatype MyThing = MyThingConstructor
//                 ^^^^^^^^^^^^^^^^^^
// ideally like a method, but needs semantics

method test() {
// Issue#70 The string should be highlighted correctly
  var tmp :=
    "This string does not have any reserved words to highlight.";
}
class {:extern "MyClass"} MyClass<T, U, V> {
}                      // ^^^^^^^ ^  ^  ^  should be a type

class MyClass2<T, U, V> {
}  // ^^^^^^^^ ^  ^  ^  should be a type

class MyClass3 {
}  // ^^^^^^^^ should be a type

class {:extern "MyClass3"} MyClass3 {
}                       // ^^^^^^^^ should be a type


method MyMethod(x: MyClass<bool, int, bool>, k: int)
// Text#68         ^^^^^^^ ^^^^  ^^^  ^^^^ should all be blue   

// Issue#64-1: This comment should be highlighted as a comment
class Foo
  // Issue#64-2: This comment should be highlighted as a comment
  extends Bar<T>
//^^^^^^^ ^^^ should be highlighted as keywords and type
{}

method CallGeneral() {
  // Issue#62-1: This comment should be highlighted as a comment
  var x := General(
    // Issue#62-2: This comment should be highlighted as a comment
    1
  )
}

// Issue#59-1: This comment should be highlighted as a comment
method Thing(
  // Issue#59-2: This comment should be highlighted as a comment
  a: nat
)