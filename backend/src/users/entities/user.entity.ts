export class User {
    id: number;
    email: string;
    password: string;
    createdAt: Date;

    constructor(email: string, password: string) {
        this.email = email;
        this.password = password;
        this.createdAt = new Date();
    }
}