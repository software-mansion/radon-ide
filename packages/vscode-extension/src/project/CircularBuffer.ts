export class CircularBuffer<T> {
  private buffer: Array<T>;
  private size: number;
  private capacity: number;
  private tailIndex: number;

  constructor(capacity: number) {
    this.size = 0;
    this.tailIndex = 0;
    this.capacity = capacity;
    this.buffer = Array<T>(this.capacity);
  }

  public write(value: T) {
    this.buffer[this.tailIndex] = value;
    this.tailIndex = (this.tailIndex + 1) % this.capacity;
    this.size = Math.min(this.size + 1, this.capacity);
  }

  public clear() {
    this.tailIndex = 0;
    this.buffer.length = 0;
    this.size = 0;
  }

  public readAll(): T[] {
    return [
      ...this.buffer.slice(this.tailIndex, this.size),
      ...this.buffer.slice(0, this.tailIndex),
    ];
  }
}
