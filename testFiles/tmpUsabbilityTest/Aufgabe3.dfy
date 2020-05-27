method MultipleReturns(number1: int, number2: int) returns (more: int, less: int)
   ensures less < number1 < more
{
   more := number1 + number2;
   less := number1 - number2;
}