export class User {
    id: number;
    email: string;
    password: string;
    createdAt: Date;
    picture?: string; // avatar

    constructor(email: string, password: string, picture?: string) {
        this.email = email;
        this.password = password;
        this.createdAt = new Date();
        this.picture = picture;
    }
}