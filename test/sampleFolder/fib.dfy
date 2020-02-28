 function Fibonacci(n: int): int
  decreases n
{
  if n < 2 then n else Fibonacci(n+2) + Fibonacci(n+1)
}
