class MyClass {
    var field: int; 
    method  addOne(i: int) returns (r:int) {
       r := i + 1;
       return r; 
    }
    method aMethod() modifies this { 
        var aLocalVar := 2;
        field := aLocalVar;  
        aLocalVar := addOne(field);
    }
    constructor () { }
    
}