method MultipleReturns(inp1: int, inp2: int) returns (more: int, less: int)
{
   more := inp1 + inp2;
   less := inp1 - inp2;
}
class ClassA {
   constructor () { }
   method myMethod() { /* do something */ }
}

class ClassB {
   constructor () { }
   method myMethod() { /* do something */ }
}

class ClassC {
   var ABC: int;
   constructor () { }
   method myMethod() { /* do something */ }
}

/*
   Huge space. This part of the file the user must not see. 
*/
method Main() {
   var myNumber := 1+2;
   var myClassA := new ClassA();
   myClassA.myMethod();
   var myClassB1 := new ClassB();
   var myClassB2 := new ClassB();
   myClassB1.myMethod();
   myClassB2.myMethod();
   myClassB2.myMethod();

   var more;
   var less;
   more, less := MultipleReturns(1,2);
   
   var abc := new ClassC();
   abc.ABC := 1;
}