// Issue #121: Generic and Regular should be highlighted with the same color
predicate Generic<Bar>(foo: Bar){}
predicate Generic<Bar<Foo>>(foo: Bar){}
predicate Generic<Bar<Foo<Blah>>>(foo: Bar){}
predicate Regular(foo: Baz){}

// Issue#120: 'Purple?' should be highlighted entirely
predicate Purple?(foo: Bar){}
predicate IsPurple(foo: Bar){}

// NOT WORKING YET - need semantic highlighting
// Issue#106: The three "bool" should be blue
datatype D = D((bool) -> bool) | E(bool)

// Issue#85: Strings should be highlighted correctly.
method Foo() returns (res: Result<string, string>)
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
}

// Issue#79-1: `Foo2` should be a function
// Issue#79-2: `Bar` should be a function
function Foo2<T>(bar: T): T {
  Bar<Boxed<T>>(Box(arg)).value
}
// Issue#79-3: `Bar` should be a function
function Bar<T>(arg: T): T {
  arg
}
datatype Boxed<T> = Box(value: T)

method test() {
// Issue#70 The string should be highlighted correctly
  var tmp := "This string does not have any reserved words that should be highlighted.";
}

class {:extern} MyClass<T, U, V> {}

method MyMethod(x: MyClass<bool, int, bool>, k: int)
// Text#68         ^^^^^^^ ^^^^  ^^^  ^^^^ should all be blue   

// Issue#64-1: This comment should be highlighted as a comment
class Foo
  // Issue#64-2: This comment should be highlighted as a comment
  extends Bar
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