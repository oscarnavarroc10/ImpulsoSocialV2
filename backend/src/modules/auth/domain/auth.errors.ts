export class DuplicateUserEmailError extends Error {
  constructor() {
    super('Ya existe un usuario con este correo electrónico');
    this.name = DuplicateUserEmailError.name;
  }
}
