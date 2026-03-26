variable "aws_region" {
  type        = string
  description = "AWS region for the instance"
  default     = "us-east-1"
}

variable "instance_type" {
  type        = string
  description = "EC2 instance type"
  default     = "t3.small"
}

variable "key_name" {
  type        = string
  description = "Name of an existing EC2 Key Pair (for SSH access)"
}

variable "allowed_cidr" {
  type        = string
  description = "CIDR allowed to reach port 3000 (and 22 for SSH). Restrict in production."
  default     = "0.0.0.0/0"
}

variable "repo_url" {
  type        = string
  description = "Git URL to clone Elkwatch (set to your fork)"
  default     = "https://github.com/YOUR_USERNAME/elkwatch.git"
}
