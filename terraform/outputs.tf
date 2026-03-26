output "public_ip" {
  description = "Public IP — open http://<ip>:3000 after configuring config.yml and docker compose up"
  value       = aws_instance.elkwatch.public_ip
}

output "ssh_hint" {
  description = "SSH as ec2-user using your key pair"
  value       = "ssh -i <your-key.pem> ec2-user@${aws_instance.elkwatch.public_ip}"
}
