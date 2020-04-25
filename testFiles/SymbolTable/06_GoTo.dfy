method MultipleReturns(inp1: int, inp2: int) returns (more: int, less: int)
   requires inp2 > 0  				//noch nciht suppoprted ;)
   ensures less < inp1 < more  		//noch nciht suppoprted ;)
{
   more := inp1 + inp2;
   less := inp1 - inp2;
   assert more == 0 ; 				//noch nciht suppoprted ;)
}
class ClassA {
   constructor () { }
   method myMethod() { /* do something */ }
}

class ClassB {
   constructor () { }
   method myMethod() { /* do something */ }
}

method Main() {
   var myNumber := 1+2;
   var classA := new ClassA();
   classA.myMethod();
   var classB := new ClassB();
   classB.myMethod();

   var more;
   var less;
   more, less := MultipleReturns(1,2);
   var some := more + less;
   
   var a := 1;
   var b := 2;
   var sum := a + b;
}