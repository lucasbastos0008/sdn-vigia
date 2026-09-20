using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SdnVigia.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAgentRestUntil : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "RestUntil",
                table: "Agents",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RestUntil",
                table: "Agents");
        }
    }
}
